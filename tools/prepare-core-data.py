"""Offline, repeatable extraction of the published 3D-GloBFP block and Terrain Tiles HGT.

Raw regional archives stay outside Git; only the clipped source records are committed.
No network requests or credentials are used by this script.
"""
from pathlib import Path
import base64,gzip,hashlib,json,math
import numpy as np
import shapefile
from shapely.geometry import shape,box,mapping
from shapely import make_valid
from city_profile import load_profile

ROOT=Path(__file__).resolve().parents[1]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def main():
    profile=load_profile();bounds=profile['boundsWgs84'];region=box(*bounds)
    paths=list((ROOT/'data/reference/3d-globfp').glob('*.shp'))
    if len(paths)!=1:raise SystemExit('Extract the published Hubei 2322 ZIP into data/reference/3d-globfp first.')
    shp=paths[0]
    if 'GCS_WGS_1984' not in shp.with_suffix('.prj').read_text():raise ValueError('Expected WGS84 geographic CRS')
    reader=shapefile.Reader(str(shp));features=[]
    for row in reader.iterShapeRecords(bbox=bounds):
        h=float(row.record['Height'])
        if not math.isfinite(h) or not 2<=h<=650:continue
        g=make_valid(shape(row.shape.__geo_interface__))
        if not g.intersects(region):continue
        # Keep original polygons intact for matching; scene generation does the boundary clipping.
        features.append({'type':'Feature','id':f'globfp-2322-{row.record.oid}',
            'properties':{'height':round(h,3),'method':'remote-sensing-model-estimate','referenceYear':2020},'geometry':mapping(g)})
    archive=ROOT/'data/reference/3d-globfp/hubei-2322.zip'
    meta={'provider':'3D-GloBFP','article':'https://figshare.com/articles/dataset/28906499','articleVersion':3,
          'download':'https://ndownloader.figshare.com/files/54107378','fileId':54107378,'block':shp.stem,
          'archiveSha256':sha(archive),'crs':'EPSG:4326','referenceYear':2020,'license':'CC BY 4.0',
          'citation':'Che et al., 2024, 3D-GloBFP: the first global three-dimensional building footprint dataset, ESSD 16, 5357–5374, https://doi.org/10.5194/essd-16-5357-2024',
          'boundsWgs84':bounds,'features':len(features),'limitations':['Model heights are estimates, not surveyed','2020 reference can differ from the 2026 OSM/Overture footprints']}
    dump(ROOT/profile['heightExtract'],{'type':'FeatureCollection','source':meta,'features':features})
    dump(ROOT/'data/source/globfp-source.json',meta)
    print('3D-GloBFP clipped features:',len(features),flush=True)

    # HGT rows go north -> south. Sample a local grid at 25m, retaining source absolute elevations.
    hgt=ROOT/'data/reference/terrain/N30E114.hgt.gz'
    raw=gzip.decompress(hgt.read_bytes());n=math.isqrt(len(raw)//2)
    if n*n*2!=len(raw):raise ValueError('Invalid HGT size')
    source=np.frombuffer(raw,dtype='>i2').reshape(n,n)
    lat0=math.radians(profile['origin'][1]);e2=6.69437999014e-3;rad=math.pi/180
    sx=rad*6378137/math.sqrt(1-e2*math.sin(lat0)**2)*math.cos(lat0)
    sz=rad*6378137*(1-e2)/(1-e2*math.sin(lat0)**2)**1.5
    w,s,e,north=bounds;res=25;x0=math.floor((w-profile['origin'][0])*sx/res)*res;z0=math.floor(-(north-profile['origin'][1])*sz/res)*res
    nx=math.ceil(((e-profile['origin'][0])*sx-x0)/res)+1;nz=math.ceil((-(s-profile['origin'][1])*sz-z0)/res)+1
    values=[]
    for j in range(nz):
        lat=profile['origin'][1]-(z0+j*res)/sz;fy=(31-lat)*(n-1);iy=min(n-2,max(0,int(fy)));ty=fy-iy
        for i in range(nx):
            lon=profile['origin'][0]+(x0+i*res)/sx;fx=(lon-114)*(n-1);ix=min(n-2,max(0,int(fx)));tx=fx-ix
            v=source[iy:iy+2,ix:ix+2].astype(float)
            if (v<=-32767).any():raise ValueError('Void in core HGT sample; do not turn voids into hills')
            values.append(round(float((v[0,0]*(1-tx)+v[0,1]*tx)*(1-ty)+(v[1,0]*(1-tx)+v[1,1]*tx)*ty),2))
    terrain={'nx':nx,'nz':nz,'x0':x0,'z0':z0,'res':res,'values':values,
        'source':{'provider':'Mapzen / Tilezen Terrain Tiles, global USGS SRTM/GMTED sources','url':'https://elevation-tiles-prod.s3.amazonaws.com/skadi/N30/N30E114.hgt.gz',
                  'sha256':sha(hgt),'sourceGridSamples':n,'verticalUnits':'m','gridFormat':'HGT, big-endian int16, north-to-south rows',
                  'attribution':'Terrain Tiles / Mapzen; global terrain data courtesy of the U.S. Geological Survey',
                  'terms':'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
                  'limitations':['Coarse global terrain, not a local survey','Building/canopy returns may affect urban samples; apply only inside explicitly declared hill masks']}}
    dump(ROOT/profile['terrainExtract'],terrain)
    print('Terrain grid:',nx,nz,'range:',min(values),max(values),flush=True)

if __name__=='__main__':main()
