from django.db import models

# Create your models here.


class DjVxymq(models.Model):
    
    appid1=models.CharField(max_length=255,blank=True,null=True)
    appid2=models.CharField(max_length=255,blank=True,null=True)
    appid3=models.CharField(max_length=255,blank=True,null=True)
    appid4=models.CharField(max_length=255,blank=True,null=True)
    slave_addr = models.CharField(max_length=255, null=True)
    data_field = models.CharField(max_length=255,null=True,blank=True)
    code_field = models.CharField(max_length=255,null=True,blank=True)
    code_num = models.CharField(max_length=255,null=True,blank=True)
    title_video = models.CharField(max_length=255,null=True,blank=True)
    photo_video = models.CharField(max_length=255,null=True,blank=True)
    downurl_video = models.CharField(max_length=255,null=True,blank=True)
    title_photo = models.CharField(max_length=255,null=True,blank=True)
    photo_photo = models.CharField(max_length=255,null=True,blank=True)
    pics_photo = models.CharField(max_length=255,null=True,blank=True)
    adUnitId = models.CharField(max_length=255,null=True,blank=True)