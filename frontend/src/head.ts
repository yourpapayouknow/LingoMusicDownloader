// 前端依赖集中导出与共享类型定义模块
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  createContext,
  useContext,
  forwardRef,
  StrictMode,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ImgHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createRoot } from 'react-dom/client'

export {
  createRoot,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  createContext,
  useContext,
  forwardRef,
  StrictMode,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ImgHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
}

// 动态加载Tauri原生窗口模块
export async function ldtrwin() {
  return import('@tauri-apps/api/window')
}

// 动态加载Tauri WebView窗口模块
export async function ldtrwbvw() {
  return import('@tauri-apps/api/webviewWindow')
}

// 动态加载Tauri核心调用模块
export async function ldtrcore() {
  return import('@tauri-apps/api/core')
}
