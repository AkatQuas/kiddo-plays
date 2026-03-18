import { ChevronLeftIcon, GearIcon } from '@radix-ui/react-icons';
import { Dialog } from 'radix-ui';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../common/button';
import { SessionList } from '../session/session_list';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  className?: string;
}

const SidebarContent = forwardRef<HTMLDivElement, SidebarProps>(
  ({ open, setOpen, className }, ref) => (
    <div
      ref={ref}
      className={`
        fixed inset-y-0 left-0 z-50 w-72 border-r bg-background
        transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}
        ${className}
      `}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b p-4 h-16">
        <h2 className="text-lg font-semibold">Conversations</h2>

        {/* Close button (mobile) */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(false)}
        >
          <ChevronLeftIcon className="h-4 w-4 rotate-180" />
        </Button>

        {/* Settings button */}
        <Button variant="ghost" size="icon" asChild className="ml-auto lg:ml-0">
          <Link to="/config">
            <GearIcon className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Sidebar content */}
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <SessionList />
      </div>
    </div>
  )
);

SidebarContent.displayName = 'SidebarContent';

export const Sidebar = ({ open, setOpen }: SidebarProps) => {
  return (
    <>
      {/* Mobile sidebar trigger */}
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button variant="secondary" size="icon">
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>Conversations</Dialog.Title>
            <Dialog.Description />
            <SessionList />
            {/* <Dialog.Close /> */}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <SidebarContent open={open} setOpen={setOpen} />

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};
