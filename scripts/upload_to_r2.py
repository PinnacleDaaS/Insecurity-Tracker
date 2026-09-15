import boto3, json, os
from botocore.config import Config

acct = os.environ.get("R2_ACCOUNT_ID", '8d09695e979b196e0987e8f426f12fa9')
bucket = os.environ.get("R2_BUCKET", 'insecurity-tracker')
access_key = os.environ.get("R2_ACCESS_KEY", '69b881d7b066d4cee55344e882ea1e93')
secret_key = os.environ.get("R2_SECRET_KEY", 'b5f71f001ec67baa7b25113a107fa40c8beb52fba13fadbea0e89317fb954b09')
endpoint = 'https://' + acct + '.r2.cloudflarestorage.com'

s3 = boto3.client('s3',
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version='s3v4'),
    region_name='auto')

filepath = 'tracker-app/public/data/incidents.json'
notes_path = 'tracker-app/public/data/notes.json'
filesize = os.path.getsize(filepath)

print('Uploading incidents.json (' + str(round(filesize/1e6, 1)) + ' MB)...')
s3.upload_file(filepath, bucket, 'incidents.json', ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=3600'})
print('incidents.json uploaded')

ts = ''
try:
    import subprocess
    ts = subprocess.check_output(['git', 'log', '-1', '--format=%cI']).decode().strip()
except Exception:
    ts = ''

if not ts:
    import datetime
    ts = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

with open(filepath) as f:
    rows = json.load(f)

notes = {}
notes_size = 0
if os.path.exists(notes_path):
    with open(notes_path) as f:
        notes = json.load(f)
    notes_size = os.path.getsize(notes_path)
    print('Uploading notes.json (' + str(round(notes_size/1e6, 1)) + ' MB)...')
    s3.upload_file(notes_path, bucket, 'notes.json', ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=3600'})
    print('notes.json uploaded')

# rows sorted most-recent-first: rows[0] is newest, rows[-1] is oldest
meta = {
    'updated_at': ts,
    'row_count': len(rows),
    'notes_count': len(notes),
    'file_size': filesize,
    'date_min': rows[-1]['event_date'] if rows else None,
    'date_max': rows[0]['event_date'] if rows else None,
}

print('Rows: ' + str(meta['row_count']) + ', Notes: ' + str(meta['notes_count']) + ', Date range: ' + str(meta['date_min']) + ' - ' + str(meta['date_max']))
s3.put_object(Bucket=bucket, Key='meta.json', Body=json.dumps(meta).encode(), ContentType='application/json', CacheControl='no-cache')
print('meta.json uploaded')
print('Done!')