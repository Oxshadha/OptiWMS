"use client";

import { Modal } from "./Modal";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function DetailModal({ isOpen, onClose, title, children, size = "lg" }: DetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      {children}
    </Modal>
  );
}

