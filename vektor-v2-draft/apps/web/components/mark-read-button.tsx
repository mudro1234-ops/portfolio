"use client";
import { ActionButton } from "@/components/action-form";
import { markAllRead } from "@/app/(app)/notifications/actions";

export function MarkAllReadButton() { return <ActionButton action={markAllRead}>Mark all as read</ActionButton>; }
