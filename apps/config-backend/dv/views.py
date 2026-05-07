from django.shortcuts import render

# Create your views here.

from django.views import View
from rest_framework.response import Response
from rest_framework.views import APIView
from . import ser
from .models import DjVxymq

from django.http import HttpResponse
import requests
from .ser import YmqSerializer

import base64
import os
import hashlib
import time
from django.db.utils import DatabaseError, OperationalError
from django.core import signing


def is_truthy(value):
    return str(value or '').lower() in ('1', 'true', 'yes', 'on')


class Ymq(APIView):
    def encode_value(self, value):
        if value is None:
            return ""
        return base64.b64encode(value.encode()).decode()

    def decode_value(self, encoded_value):
        if encoded_value is None:  # 同样以防止 decode NoneType
            return None  # 返回适当的默认值
        return base64.b64decode(encoded_value.encode()).decode()

    def get_local_runtime_config(self):
        return {
            "appid1": os.getenv("CONFIG_BACKEND_APPID1", ""),
            "appid2": os.getenv("CONFIG_BACKEND_APPID2", ""),
            "appid3": os.getenv("CONFIG_BACKEND_APPID3", ""),
            "appid4": os.getenv("CONFIG_BACKEND_APPID4", ""),
            "slave_addr": os.getenv("CONFIG_BACKEND_SLAVE_ADDR", "http://127.0.0.1:8091/api/hybrid/video_data?url="),
            "slave_addr2": os.getenv("CONFIG_BACKEND_SLAVE_ADDR2", ""),
            "backup_addr": os.getenv("CONFIG_BACKEND_BACKUP_ADDR", ""),
            "adUnitId": os.getenv("CONFIG_BACKEND_AD_UNIT_ID", ""),
        }

    def get_runtime_config(self):
        local_runtime_config = self.get_local_runtime_config()
        if is_truthy(os.getenv("CONFIG_BACKEND_FORCE_LOCAL", "")):
            return local_runtime_config

        try:
            obj = DjVxymq.objects.get(id=1)
            serializer = YmqSerializer(obj)
            runtime_config = dict(serializer.data)
            runtime_config["slave_addr"] = os.getenv(
                "CONFIG_BACKEND_SLAVE_ADDR",
                runtime_config.get("slave_addr") or local_runtime_config["slave_addr"]
            )
            runtime_config["slave_addr2"] = os.getenv("CONFIG_BACKEND_SLAVE_ADDR2", "")
            runtime_config["backup_addr"] = os.getenv("CONFIG_BACKEND_BACKUP_ADDR", "")
            runtime_config["adUnitId"] = os.getenv(
                "CONFIG_BACKEND_AD_UNIT_ID",
                runtime_config.get("adUnitId") or local_runtime_config["adUnitId"]
            )
            return runtime_config
        except (DjVxymq.DoesNotExist, OperationalError, DatabaseError):
            return local_runtime_config

    def build_response_data(self, runtime_config):
        import random
        import string

        def random_variable_name(length=8):
            return ''.join(random.choices(string.ascii_lowercase, k=length))

        # 定义每个列表项为随机命名的字符串变量
        random_var1 = ''.join(["ti", "tle"])
        random_var2 = ''.join(["c", "ov", "er"])
        random_var3 = ''.join(["u", "rl"])
        random_var4 = ''.join(["tit", "le"])
        random_var5 = ''.join(["co", "ver", "_url"])
        random_var6 = ''.join(["images"])

        # 将每个随机命名的变量存储到字典中，以便后续处理
        variables = {
            random_variable_name(): random_var1,
            random_variable_name(): random_var2,
            random_variable_name(): random_var3,
            random_variable_name(): random_var4,
            random_variable_name(): random_var5,
            random_variable_name(): random_var6,
        }

        dkje = variables[list(variables.keys())[0]]
        eijs = variables[list(variables.keys())[1]]
        woeh = variables[list(variables.keys())[2]]
        souw = variables[list(variables.keys())[3]]
        dheu = variables[list(variables.keys())[4]]
        djru = variables[list(variables.keys())[5]]

        data = {
            "appid1": self.encode_value(runtime_config.get('appid1', '')),
            "appid2": self.encode_value(runtime_config.get('appid2', '')),
            "appid3": self.encode_value(runtime_config.get('appid3', '')),
            "appid4": self.encode_value(runtime_config.get('appid4', '')),
            "slave_addr": self.encode_value(runtime_config.get('slave_addr', '')),
            "slave_addr2": self.encode_value(runtime_config.get('slave_addr2', '')),
            "backup_addr": self.encode_value(runtime_config.get('backup_addr', '')),
            "adUnitId": self.encode_value(runtime_config.get('adUnitId', '')),
            "data_field": self.encode_value("data"),
            "code_field": self.encode_value("code"),
            "code_num": self.encode_value("200"),
            "title_video": self.encode_value(dkje),
            "photo_video": self.encode_value(eijs),
            "downurl_video": self.encode_value(woeh),
            "title_photo": self.encode_value(souw),
            "photo_photo": self.encode_value(dheu),
            "pics_photo": self.encode_value(djru),
        }
        return {key: self.decode_value(value) for key, value in data.items()}

    def get(self, request):
        runtime_config = self.get_runtime_config()
        response_data = self.build_response_data(runtime_config)
        return Response({'data': response_data})


class WechatLogin(APIView):
    def post(self, request):
        code = str(request.data.get('code') or '').strip()
        profile = request.data.get('profile') or {}

        if not code:
            return Response({'error': 'missing code'}, status=400)

        profile = profile if isinstance(profile, dict) else {}
        nickname = str(profile.get('nickName') or '微信用户').strip()[:32] or '微信用户'
        avatar_url = str(profile.get('avatarUrl') or '').strip()

        openid_seed = hashlib.sha256(code.encode('utf-8')).hexdigest()
        openid = f'wx_{openid_seed[:24]}'
        issued_at = int(time.time())
        expires_at = issued_at + 7 * 24 * 60 * 60

        session_token = signing.dumps({
            'openid': openid,
            'issued_at': issued_at,
            'expires_at': expires_at
        })

        return Response({
            'user': {
                'id': openid,
                'openid': openid,
                'nickname': nickname,
                'avatarUrl': avatar_url,
                'source': 'backend-session'
            },
            'session': {
                'token': session_token,
                'expiresAt': expires_at * 1000
            }
        })

import requests
from django.http import HttpResponse, JsonResponse

def get_video_size(request):
    url = request.GET.get("url")
    if not url:
        return JsonResponse({"error": "无效的请求"}, status=400)
    
    try:
        # 发送 HEAD 请求获取视频大小
        head_response = requests.head(url, timeout=5)
        head_response.raise_for_status()  # 检查请求是否成功
        
        content_length = head_response.headers.get('Content-Length')
        if content_length is None:
            return JsonResponse({"error": "无法获取视频大小"}, status=404)

        return JsonResponse({"content_length": content_length})
    
    except requests.exceptions.RequestException as e:
        return JsonResponse({"error": f"请求失败: {str(e)}"}, status=500)

# 更新原有的 download_video 函数
def download_video(request):
    url = request.GET.get("url")
    if not url:
        return HttpResponse("无效的请求", status=400)
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # 设置响应头
        response_headers = {
            'Content-Type': 'video/mp4',
            'Content-Length': response.headers.get('Content-Length', 0),
        }
        
        # 返回视频内容
        http_response = HttpResponse(response.iter_content(chunk_size=8192), headers=response_headers)
        return http_response
    
    except requests.exceptions.RequestException as e:
        return HttpResponse(f"请求失败: {str(e)}")

def download_image(request):
    url = request.GET.get("url")
    if not url:
        return HttpResponse("wuxiao",status=400)
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()  # 抛出HTTPError异常
        response_headers = {
            'Content-Type': 'image/jpeg',
            'Content-Length': response.headers.get('Content-Length', 0),
                        }
        http_response = HttpResponse(response.iter_content(chunk_size=8192), headers=response_headers)
        return http_response
    except requests.exceptions.RequestException as e:
        return HttpResponse(f"shibai:{str(e)}")
