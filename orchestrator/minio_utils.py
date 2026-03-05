import os
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_PUBLIC_ENDPOINT = os.getenv("S3_PUBLIC_ENDPOINT", "http://localhost:9002")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "admin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "supersecretpassword")
S3_BUCKET = os.getenv("S3_BUCKET", "games")

s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

def init_minio():
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            s3_client.create_bucket(Bucket=S3_BUCKET)
            # Make the bucket public for easy reading via browser (in production, use presigned urls)
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "PublicReadGetObject",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{S3_BUCKET}/*"]
                    }
                ]
            }
            import json
            s3_client.put_bucket_policy(Bucket=S3_BUCKET, Policy=json.dumps(policy))

def upload_file_to_minio(file_name_in_bucket: str, file_bytes: bytes, content_type: str = "application/octet-stream"):
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=file_name_in_bucket,
        Body=file_bytes,
        ContentType=content_type
    )
    return f"{S3_PUBLIC_ENDPOINT}/{S3_BUCKET}/{file_name_in_bucket}"

def generate_presigned_url(client_method: str, file_name_in_bucket: str, expires_in: int = 3600) -> str:
    url = s3_client.generate_presigned_url(
        ClientMethod=client_method,
        Params={
            'Bucket': S3_BUCKET,
            'Key': file_name_in_bucket
        },
        ExpiresIn=expires_in
    )
    # Replace internal Docker endpoint with the public accessible endpoint for Vast
    if S3_ENDPOINT in url:
        url = url.replace(S3_ENDPOINT, S3_PUBLIC_ENDPOINT)
    return url

def get_presigned_get_url(file_name_in_bucket: str, expires_in: int = 3600) -> str:
    return generate_presigned_url('get_object', file_name_in_bucket, expires_in)

def get_presigned_put_url(file_name_in_bucket: str, expires_in: int = 3600) -> str:
    return generate_presigned_url('put_object', file_name_in_bucket, expires_in)
