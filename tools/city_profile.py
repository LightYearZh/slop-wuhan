"""Shared area configuration for import and scene generation."""
import json,os,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]

def load_profile(path=None):
    file=pathlib.Path(path or os.environ.get('WUHAN_PROFILE',ROOT/'config/wuhan-core.json')).resolve()
    data=json.loads(file.read_text(encoding='utf-8'))
    w,s,e,n=data['boundsWgs84']
    if not (-180<=w<e<=180 and -90<=s<n<=90):raise ValueError('Invalid boundsWgs84: W S E N required')
    # Keep the runtime WGS84 frame stable while extending the area.
    if data['origin']!=[114.293,30.585] or data['tileSizeM']!=500:
        raise ValueError('Current runtime requires the fixed Wuhan origin and 500m tiles')
    data['_file']=str(file)
    return data


def importer_fingerprint():
    import hashlib
    return hashlib.sha256(b''.join((ROOT/'tools'/name).read_bytes() for name in ('import-citywide.py','building_attributes.py'))).hexdigest()
