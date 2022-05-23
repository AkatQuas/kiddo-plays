import { Button, ButtonProps, message } from 'antd';
import { fetchUserRole, UserRole } from 'apis/user';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import styles from './styles.module.less';

type AuthButtonProps = ButtonProps;
const mapper = {
  user: 'User',
  admin: 'Admin',
};

export const AuthButton = ({
  children,
  className,
  ...rest
}: AuthButtonProps) => {
  const [userRole, setUserRole] = useState<UserRole>();

  useEffect(() => {
    fetchUserRole()
      .then((r) => {
        setUserRole(r.role);
      })
      .catch((e) => message.error(e.message));
    return () => {};
  }, []);

  return (
    <>
      <p>Role: {mapper[userRole!] ?? 'Unauthorized'}</p>
      <Button {...rest} className={classNames(className, styles.authButton)}>
        {children}
      </Button>
    </>
  );
};
