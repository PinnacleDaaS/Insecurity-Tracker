import boto3, json, os, subprocess
from botocore.config import Config

acct = '8d09695e979b196e0987e8f426f12fa9'
bucket = 'insecurity-tracker'
access_key = '69b881d7b066d4cee55344e882ea1e93'
secret_key = 'b5f71f001ec67baa7b25113a107fa40c8beb52fba13fadbea0e89317fb954b09'
endpoint = 'https://' + acct + '.r2.cloudflarestorage.com'

s3 = boto3.client('s3',
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version='s3v4'),
    region_name='auto')

filepath = 'tracker-app/public/data/incidents.json'
filesize = os.path.getsize(filepath)
print('Uploading incidents.json (' + str(round(filesize/1e6, 1)) + ' MB)...')
s3.upload_file(filepath, bucket, 'incidents.json', ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=3600'})
print('incidents.json uploaded')

ts = subprocess.check_output(['git', 'log', '-1', '--format=%cI']).decode().strip()

with open(filepath) as f:
    rows = json.load(f)

meta = {
    'updated_at': ts,
    'row_count': len(rows),
    'file_size': filesize,
    'date_min': rows[0]['event_date'] if rows else None,
    'date_max': rows[-1]['event_date'] if rows else None,
}

print('Rows: ' + str(meta['row_count']) + ', Date range: ' + str(meta['date_min']) + ' - ' + str(meta['date_max']))
s3.put_object(Bucket=bucket, Key='meta.json', Body=json.dumps(meta).encode(), ContentType='application/json', CacheControl='no-cache')
print('meta.json uploaded')
print('Done!')