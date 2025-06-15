import React, { useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, Slide, type SlideProps } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store';
import { removeNotification } from '@/store/slices/uiSlice';

type TransitionProps = Omit<SlideProps, 'children'>;

function SlideTransition(props: TransitionProps) {
  return <Slide {...props} direction="up" />;
}

export const NotificationContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.ui.notifications);

  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  // Auto-remove notifications after their duration
  useEffect(() => {
    notifications.forEach((notification) => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          dispatch(removeNotification(notification.id));
        }, notification.duration);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, dispatch]);

  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          onClose={() => handleClose(notification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            position: 'fixed',
            bottom: 16 + index * 80,
            right: 16,
            zIndex: (theme) => theme.zIndex.snackbar + index,
          }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.type}
            variant="filled"
            sx={{
              minWidth: 300,
              maxWidth: 500,
              boxShadow: 3,
            }}
          >
            {notification.title && (
              <AlertTitle>{notification.title}</AlertTitle>
            )}
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};