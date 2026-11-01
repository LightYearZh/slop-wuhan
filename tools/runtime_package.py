"""Lossless Wuhan data packing, adapted from mrdoob's NYB1 gzip/varint asset strategy.
WUH1: UTF-8 shared string table, tagged values, separate alternating coordinate deltas.
No footprint simplification, quantization or removal of source geography.
"""
import gzip,math,struct

def encode_runtime(value):
    strings=[];indices={}
    def intern(s):
        if s not in indices:indices[s]=len(strings);strings.append(s)
    def visit(v):
        if isinstance(v,str):intern(v)
        elif isinstance(v,list):
            for x in v:visit(x)
        elif isinstance(v,dict):
            for k,x in v.items():intern(k);visit(x)
    visit(value);out=bytearray(b'WUH1')
    def uint(n):
        if not 0<=n<=0xffffffff:raise ValueError('Varint overflow')
        while n>=128:out.append((n&127)|128);n>>=7
        out.append(n)
    def signed(n):uint((n<<1)^(n>>31))
    def negative_zero(n):return n==0 and math.copysign(1,n)<0
    def scaled(n):
        if not math.isfinite(n) or negative_zero(n):return None
        x=round(n*1000)
        return x if -0x40000000<=x<=0x3fffffff and x/1000==n else None
    uint(len(strings))
    for s in strings:
        b=s.encode();uint(len(b));out.extend(b)
    def write(v):
        if v is None:out.append(0)
        elif v is False:out.append(1)
        elif v is True:out.append(2)
        elif isinstance(v,(int,float)):
            if not math.isfinite(v):raise ValueError('Non-finite runtime number')
            if not negative_zero(v) and v==int(v) and -0x80000000<=v<=0x7fffffff:out.append(3);signed(int(v))
            elif scaled(v) is not None:out.append(4);signed(scaled(v))
            else:out.append(5);out.extend(struct.pack('<d',v))
        elif isinstance(v,str):out.append(6);uint(indices[v])
        elif isinstance(v,list):
            if v and all(type(n) in (int,float) and not negative_zero(n) and n==int(n) and -0x80000000<=n<=0x7fffffff for n in v):
                out.append(10);uint(len(v))
                for n in v:signed(int(n))
                return
            nums=[scaled(n) for n in v] if v and all(type(n) in (int,float) for n in v) else []
            if nums and all(n is not None for n in nums):
                out.append(9);uint(len(nums));previous=[0,0]
                for i,n in enumerate(nums):signed(n-previous[i%2]);previous[i%2]=n
            else:
                out.append(7);uint(len(v))
                for x in v:write(x)
        elif isinstance(v,dict):
            out.append(8);uint(len(v))
            for k,x in v.items():uint(indices[k]);write(x)
        else:raise TypeError(type(v))
    write(value);return bytes(out)

def runtime_view(geo):
    # Placement reads source outlines, not the full attributes/audit database. Retain the
    # millimetre source rings (rendered decimetre rings cannot replace them for collision clearance).
    placement=geo['placementData']
    return {**geo,'placementData':{**placement,'buildings':[{'rings':b['rings']} for b in placement['buildings']],
        'roads':[{k:r[k] for k in ('id','name','mode','width','points','bridge') if k in r} for r in placement['roads']]}}

def pack_runtime(geo):
    raw=encode_runtime(runtime_view(geo))
    return raw,gzip.compress(raw,compresslevel=9,mtime=0)
