import boto3
import os
from botocore.client import Config

S3_ENDPOINT = os.environ.get('S3_ENDPOINT', 'http://localhost:9000')
S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY', 'minioadmin')
S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY', 'minioadmin')
S3_BUCKET_ARTIFACTS = os.environ.get('S3_BUCKET_ARTIFACTS', 'gomech-artifacts')

s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version='s3v4')
)

def get_presigned_upload_url(object_name: str, expiration=3600):
    """Generate a presigned URL to upload a file"""
    try:
        response = s3_client.generate_presigned_url('put_object',
                                                    Params={'Bucket': S3_BUCKET_ARTIFACTS,
                                                            'Key': object_name},
                                                    ExpiresIn=expiration)
    except Exception as e:
        print(f"Error generating presigned upload url: {e}")
        return None
    return response

def get_presigned_download_url(object_name: str, expiration=3600):
    """Generate a presigned URL to share a file"""
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': S3_BUCKET_ARTIFACTS,
                                                            'Key': object_name},
                                                    ExpiresIn=expiration)
    except Exception as e:
        print(f"Error generating presigned download url: {e}")
        return None
    return response
