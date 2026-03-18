import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatStore } from '../store/chat';

export const useMessageList = (sessionId: string | null) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Get messages from store
  const { messages, isStreaming } = chatStore((state) => ({
    messages: state.messages[sessionId || ''] || [],
    isStreaming: state.isStreaming
  }));

  console.debug(
    '\x1B[97;100;1m --- what messages have --- \x1B[m',
    '\n',
    messages
  );
  const displayMessages = useMemo(
    // more filter
    () => messages.filter((m) => m.content),
    [messages]
  );
  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80, // Estimated message height
    measureElement: (element: HTMLElement) => {
      console.debug('\x1B[97;100;1m --- calc --- \x1B[m', '\n', element);
      return element ? element.getBoundingClientRect().height : 80;
    },
    overscan: 5 // Pre-render 5 messages outside viewport
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAtBottom && containerRef.current && displayMessages.length > 0) {
      // Wait for DOM update
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [displayMessages, isStreaming, isAtBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const bottomThreshold = 20; // 20px from bottom
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - bottomThreshold);
  }, []);

  // Scroll to bottom manually
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  // Scroll to top manually
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setIsAtBottom(false);
    }
  }, []);

  return {
    containerRef,
    virtualizer,
    messages: displayMessages,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    scrollToTop
  };
};
