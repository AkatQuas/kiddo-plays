from django.urls import path

from . import views

urlpatterns = [
    path("snippets/", views.snippet_list),
    path("snippets/<int:pk>/", views.snippet_detail),
    path("snippets-view/", views.SnippetList.as_view()),
    path("snippets-view/<int:pk>/", views.SnippetDetail.as_view()),
    path("users/", views.UserList.as_view()),
    path("users/<int:pk>/", views.UserDetail.as_view()),
]
