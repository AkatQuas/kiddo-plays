#! /usr/bin/env bash

i=0
while [ $i -ne 50 ]
do
  i=$((i+1))
  echo "refresh count: $i"
  sleep 2
  adb shell input swipe 500 1200 500 600 200
  sleep 3
  # search icon
  adb shell input tap 1013 155
  sleep 2
  # tap query
  adb shell input tap 175 310 # query 1st
  # adb shell input tap 175 425 # query 2nd
  sleep 6
  # tap tab
  adb shell input tap 280 275 # poistion 2nd
  # adb shell input tap 630 275 # poistion 4th
  sleep 6
  # echo "Wait for EnterCarriage"
  # read -r
  # go back
  # adb shell input tap 80 150 # back icon
  adb shell input keyevent 4
  sleep 1
  adb shell input keyevent 4
  # adb shell input tap 80 150 # back icon
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
