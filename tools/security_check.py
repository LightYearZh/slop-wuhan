#!/usr/bin/env python3
"""Scan current tracked/reviewable files and Git history without printing secret values."""
import argparse,hashlib,json,platform,re,subprocess,sys,tarfile,tempfile
from pathlib import Path
from urllib.request import urlretrieve

ROOT=Path(__file__).resolve().parents[1]
VERSION='8.30.1'
ARCHIVES={
 ('Darwin','arm64'):('darwin_arm64','b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'),
 ('Darwin','x86_64'):('darwin_x64','dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'),
 ('Linux','x86_64'):('linux_x64','551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'),
 ('Linux','aarch64'):('linux_arm64','e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080'),
}
HOME_PATH=re.compile(r'''/(?:Users|home)/[^/\s"'<>]+/''')
WINDOWS_HOME=re.compile(r'''[A-Za-z]:[\\/]Users[\\/][^\\/\s"'<>]+''')
PRIVATE_IP=re.compile(r'\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b')
AUTH_URL=re.compile(r'''https?://[^\s/@:"'<>]+:[^\s/@"'<>]+@''')
PRIVATE_NAME=re.compile(r'^(?:\.env(?:\..*)?|id_(?:rsa|ed25519)(?:\..*)?|credentials\.json|\.netrc|\.npmrc|\.pypirc)$|\.(?:pem|key|p12|pfx|keystore|jks)$',re.I)

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)

def inspect_file(name,body):
    """Return metadata only. Never include a matched value or line content."""
    issues=[]
    if PRIVATE_NAME.search(Path(name).name) and Path(name).name not in ('.env.example','.env.sample'):
        issues.append({'file':name,'type':'credential-or-private-key-file','line':1})
    if b'\0' in body:return issues
    try:text=body.decode('utf-8')
    except UnicodeDecodeError:return issues
    for i,line in enumerate(text.splitlines(),1):
        for kind,pattern in [('absolute-home-path',HOME_PATH),('windows-home-path',WINDOWS_HOME),('private-network-address',PRIVATE_IP),('authenticated-url',AUTH_URL)]:
            if pattern.search(line):issues.append({'file':name,'type':kind,'line':i})
    return issues

def scanner(install=False):
    spec=ARCHIVES.get((platform.system(),platform.machine()))
    if not spec:raise RuntimeError('Unsupported scanner platform; use a supported macOS/Linux environment.')
    target,sha=spec;folder=ROOT/'.cache/security-tools'/VERSION;archive=folder/f'gitleaks_{VERSION}_{target}.tar.gz';binary=folder/'gitleaks'
    if not archive.exists():
        if not install:raise RuntimeError('Scanner is not installed. Run npm run security:setup first.')
        folder.mkdir(parents=True,exist_ok=True)
        try:urlretrieve(f'https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/{archive.name}',archive)
        except Exception:
            archive.unlink(missing_ok=True);raise RuntimeError('Official scanner download failed; retry security:setup.') from None
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=sha:raise RuntimeError('Scanner archive checksum mismatch; refusing to run.')
    with tarfile.open(archive) as t:payload=t.extractfile('gitleaks').read()
    if not binary.exists() or hashlib.sha256(binary.read_bytes()).digest()!=hashlib.sha256(payload).digest():
        binary.write_bytes(payload);binary.chmod(0o700)
    return binary

def install_hook():
    existing=subprocess.run(['git','config','--local','--get','core.hooksPath'],cwd=ROOT,capture_output=True,text=True).stdout.strip()
    if existing and existing!='.githooks':raise RuntimeError('Existing hooksPath found; refusing to replace it.')
    hook=Path(git('rev-parse','--git-path','hooks/pre-push').decode().strip())
    if not hook.is_absolute():hook=ROOT/hook
    if not existing and hook.exists():raise RuntimeError('Existing pre-push hook found; integrate it manually first.')
    subprocess.run(['git','config','--local','core.hooksPath','.githooks'],cwd=ROOT,check=True)

def run_scan(binary,mode,target,report,extra=()):
    cmd=[str(binary),mode,str(target),'--ignore-gitleaks-allow','--redact=100','--no-banner','--no-color','--report-format=json',f'--report-path={report}',*extra]
    result=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    if result.returncode not in (0,1):raise RuntimeError(f'Gitleaks {mode} did not finish; no push approval is given.')
    if not report.exists():raise RuntimeError('Scanner did not create its report.')
    findings=json.loads(report.read_text())
    if not isinstance(findings,list) or (result.returncode==1 and not findings):raise RuntimeError('Scanner returned an incomplete result.')
    # Do not print raw scanner logs or findings, including matched secrets.
    return [{'file':f.get('File'),'type':f.get('RuleID'),'line':f.get('StartLine'),'commit':f.get('Commit','')[:12]} for f in findings]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--install-scanner',action='store_true');parser.add_argument('--install-hook',action='store_true');args=parser.parse_args()
    binary=scanner(args.install_scanner)
    if args.install_hook:install_hook()
    names=sorted(set(n for n in git('ls-files','--cached','--others','--exclude-standard','-z').decode().split('\0') if n))
    report_dir=ROOT/'.cache/security-reports';report_dir.mkdir(parents=True,exist_ok=True)
    privacy=[]
    with tempfile.TemporaryDirectory(prefix='wuhan-security-') as tmp:
        export=Path(tmp)
        for name in names:
            p=ROOT/name
            if not p.exists():continue
            if p.is_symlink():privacy.append({'file':name,'type':'review-symlink-before-publish','line':1});continue
            body=p.read_bytes();privacy.extend(inspect_file(name,body));dest=export/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(body)
        current=run_scan(binary,'dir',export,report_dir/'current.json',('--max-archive-depth=2',))
    history=run_scan(binary,'git',ROOT,report_dir/'history.json',('--log-opts=--all',))
    result={'gitleaksVersion':VERSION,'head':git('rev-parse','HEAD').decode().strip(),'filesReviewed':len(names),'reachableCommits':int(git('rev-list','--all','--count')),
            'currentSecretFindings':current,'historySecretFindings':history,'currentPrivacyFindings':privacy,
            'scope':'Current files plus all local reachable Git history. Historical personal paths/author metadata are not rewritten.'}
    (report_dir/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f"Security review: {len(names)} files; {result['reachableCommits']} reachable commits; Gitleaks {VERSION}.")
    for label,findings in [('Current secrets',current),('History secrets',history),('Current privacy',privacy)]:
        print(f'{label}: {len(findings)} findings')
        for finding in findings:print(json.dumps(finding,ensure_ascii=False))
    return 1 if current or history or privacy else 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:print(f'Security check stopped: {error}',file=sys.stderr);sys.exit(2)
