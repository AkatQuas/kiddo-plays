# Usages commands

- start the server with port 

        python3 manage.py runserver 8088

- create a new app in the projet

        python3 manage.py startapp yourappname

- write your app view routes and include them in the project

    ```python
    # app/urls.py
    from django.urls import path

    from . import views

    urlpatterns = [
        path('routes', views.index, name='index'),
        ...
    ]

    # project/urls.py
    from django.contrib import admin
    from django.urls import include, path

    urlpatterns = [
        path('app/', include('app.urls')),
        path('admin/', admin.site.urls)
    ]
    ```

- active the database model form app in the project

    ```python
    # project/settings.py
    INSTALLED_APPS = [
        'app1.apps.AppConfig',
        'app2.apps.AppConfig',
        'app3.apps.AppConfig',
        ...
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
    ]
    ```

    Rememer the 3-steps guide to making model changes:

    1. Change your models (in **models.py**).

    1. Run `python3 manage.py makemigrations [appname]` to create migrations for those changes

    1. Run `python3 manage.py migrate [appname [migratenumb]] ` to apply those changes to the database.

- create an admin user and you are good to loign as an admin

        python3 manage.py createsuperuser

- shortcuts in http response and more in `django.shortcuts`

    - `render(request, template_name, context=None, content_type=None, status=None, using=None)`

    - `get_object_or_404(klass, *args, **kwargs)`

- Generic views

    With the help of template engine, it might helps

- TESTS

    write the test codes in `{{appname}}/tests.py`

        python3 manage.py test [appname]

- Customize the admin form

    [link](https://docs.djangoproject.com/en/2.1/intro/tutorial07/)
    , make the admin site more beautiful

# Reference

[The original tutorial](https://docs.djangoproject.com/en/2.1/intro/)

[The core documents](https://docs.djangoproject.com/en/2.1/topics/)