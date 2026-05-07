from django.urls import path

from dv import views

urlpatterns = [
    path('ymq/', views.Ymq.as_view(), name='ymq'),
    path('api/auth/wechat-login/', views.WechatLogin.as_view(), name='wechat_login'),
    
    path('api/get_video_size/', views.get_video_size, name='get_video_size'),
    path('api/download/video/', views.download_video, name='download_video'),
    path('api/download/image/', views.download_image, name='download_image'),

]
