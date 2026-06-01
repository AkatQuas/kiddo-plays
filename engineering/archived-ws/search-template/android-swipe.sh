#! /usr/bin/env bash

i=0
while [ $i -ne 100 ]
do
  i=$((i+1))
  echo "swipe count: $i"
  adb shell input swipe 300 700 300 400 50
  sleep 2
done

# adb devices
# adb start-server
# adb kill-server
# adb push ${HOME}/Desktop/a.png /sdcard/


# //截图命令
# adb shell /system/bin/screencap -p /sdcard/screenshot.png
# //将截图复制到电脑盘中
# adb pull /sdcard/screenshot.png ${HOME}/Desktop


# // 默认录制，结果保存在盒子的存储中
# adb shell screenrecord /sdcard/xxx.mp4 （默认录制180s）
# // 指定录制时间
# adb shell screenrecord --time-limit 60 /sdcard/xxx.mp4（录制60s）
# 将录制结果从盒子中拉到本地可参考截屏
# adb pull /sdcard/xxx.mp4 ${HOME}/Desktop
