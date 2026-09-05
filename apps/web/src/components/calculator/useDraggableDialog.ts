import { useCallback, useRef } from "react";

type Position = { x: number; y: number };

const minimumVisiblePixels = 24;

export function useDraggableDialog() {
  const offset = useRef<Position>({ x: 0, y: 0 });
  const dragStart = useRef<Position | null>(null);
  const initialOffset = useRef<Position>({ x: 0, y: 0 });
  const content = useRef<HTMLElement | null>(null);

  const contentRef = useCallback((node: HTMLElement | null) => {
    content.current = node;
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    initialOffset.current = offset.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!dragStart.current || !content.current) return;
    const next = clampPosition(
      initialOffset.current.x + event.clientX - dragStart.current.x,
      initialOffset.current.y + event.clientY - dragStart.current.y,
      content.current.offsetWidth,
      content.current.offsetHeight,
    );
    offset.current = next;
    content.current.style.translate = `calc(-50% + ${next.x}px) calc(-50% + ${next.y}px)`;
    content.current.style.transform = "none";
  }, []);

  const stopDragging = useCallback((event?: React.PointerEvent<HTMLElement>) => {
    dragStart.current = null;
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    contentRef,
    dragHandleProps: {
      onLostPointerCapture: () => stopDragging(),
      onPointerCancel: stopDragging,
      onPointerDown,
      onPointerMove,
      onPointerUp: stopDragging,
      style: { touchAction: "none" as const },
    },
  };
}

function clampPosition(x: number, y: number, width: number, height: number): Position {
  const horizontalLimit = window.innerWidth / 2 + width / 2 - minimumVisiblePixels;
  const verticalLimit = window.innerHeight / 2 + height / 2 - minimumVisiblePixels;
  return {
    x: Math.min(Math.max(x, -horizontalLimit), horizontalLimit),
    y: Math.min(Math.max(y, -verticalLimit), verticalLimit),
  };
}
