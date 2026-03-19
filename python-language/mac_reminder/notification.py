import objc
from Foundation import NSURL, NSObject
from UserNotifications import (
    UNUserNotificationCenter,
    UNMutableNotificationContent,
    UNNotificationRequest,
    UNTimeIntervalNotificationTrigger,
    UNNotificationAttachment
)
import os

class MacNotification:
    def __init__(self, sound: str = "default", timeout: int = 10):
        self.center = UNUserNotificationCenter.currentNotificationCenter()
        self.sound = sound
        self.timeout = timeout
        # 请求通知权限
        self._request_permission()

    def _request_permission(self):
        """请求MacOS通知权限"""
        self.center.requestAuthorizationWithOptions_completionHandler_(
            0x01 | 0x02,  # 允许通知+声音
            lambda granted, error: None
        )

    def send_notification(self, title: str, content: str, image_path: str = "", hyperlink: str = ""):
        """
        发送MacOS系统通知
        :param title: 通知标题
        :param content: 通知内容
        :param image_path: 本地图片路径（可选）
        :param hyperlink: 点击跳转链接（可选）
        """
        # 创建通知内容
        notification_content = UNMutableNotificationContent.alloc().init()
        notification_content.setTitle_(title)
        notification_content.setBody_(content)
        notification_content.setSoundName_(self.sound)

        # 添加图片附件（如果有）
        attachments = []
        if image_path and os.path.exists(image_path):
            try:
                image_url = NSURL.fileURLWithPath_(image_path)
                attachment = UNNotificationAttachment.attachmentWithIdentifier_URL_options_error_(
                    "image_attachment", image_url, None, None
                )
                if attachment:
                    attachments.append(attachment)
                    notification_content.setAttachments_(attachments)
            except Exception as e:
                print(f"添加图片附件失败：{e}")

        # 添加超链接（MacOS通知点击跳转需通过userInfo）
        if hyperlink:
            notification_content.setUserInfo_({"hyperlink": hyperlink})

        # 创建触发器（立即触发，延迟0秒）
        trigger = UNTimeIntervalNotificationTrigger.triggerWithTimeInterval_repeats_(0, False)

        # 创建通知请求
        request = UNNotificationRequest.requestWithIdentifier_content_trigger_(
            f"reminder_{os.urandom(4).hex()}",  # 唯一ID
            notification_content,
            trigger
        )

        # 添加通知到中心
        self.center.addNotificationRequest_(request)

        # 注册通知点击事件处理（跳转超链接）
        self.center.setDelegate_(NotificationDelegate.alloc().init())

# 通知点击事件处理类
class NotificationDelegate(NSObject):
    def userNotificationCenter_didReceiveNotificationResponse_withCompletionHandler_(self, center, response, handler):
        """处理通知点击事件"""
        user_info = response.notification.request.content.userInfo()
        hyperlink = user_info.get("hyperlink")
        if hyperlink:
            # 打开超链接（MacOS默认浏览器）
            os.system(f'open "{hyperlink}"')
        handler()