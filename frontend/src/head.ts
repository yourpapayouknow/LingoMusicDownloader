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
  StrictMode,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type ImgHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createRoot } from 'react-dom/client'
// 从@mingcute/react统一引入MingCute图标组件（来源：https://github.com/mingcute-design/mingcute-icons）
import type { IconProps as MingCuteIconProps } from '@mingcute/react'
import AddRegular from '@mingcute/react/core-regular/add'
import AddFilled from '@mingcute/react/core-filled/add'
import AlertRegular from '@mingcute/react/core-regular/alert'
import AlertFilled from '@mingcute/react/core-filled/alert'
import CaptionsRegular from '@mingcute/react/core-regular/captions'
import CaptionsFilled from '@mingcute/react/core-filled/captions'
import CheckRegular from '@mingcute/react/core-regular/check'
import CheckFilled from '@mingcute/react/core-filled/check'
import CloseRegular from '@mingcute/react/core-regular/close'
import CloseFilled from '@mingcute/react/core-filled/close'
import Delete2Regular from '@mingcute/react/core-regular/delete-2'
import Delete2Filled from '@mingcute/react/core-filled/delete-2'
import DownRegular from '@mingcute/react/core-regular/down'
import DownFilled from '@mingcute/react/core-filled/down'
import Download2Regular from '@mingcute/react/core-regular/download-2'
import Download2Filled from '@mingcute/react/core-filled/download-2'
import Earth4Regular from '@mingcute/react/core-regular/earth-4'
import Earth4Filled from '@mingcute/react/core-filled/earth-4'
import FolderRegular from '@mingcute/react/core-regular/folder'
import FolderFilled from '@mingcute/react/core-filled/folder'
import GithubRegular from '@mingcute/react/core-regular/github'
import GithubFilled from '@mingcute/react/core-filled/github'
import Home2Regular from '@mingcute/react/core-regular/home-2'
import Home2Filled from '@mingcute/react/core-filled/home-2'
import InformationRegular from '@mingcute/react/core-regular/information'
import InformationFilled from '@mingcute/react/core-filled/information'
import LinkRegular from '@mingcute/react/core-regular/link'
import LinkFilled from '@mingcute/react/core-filled/link'
import MenuRegular from '@mingcute/react/core-regular/menu'
import MenuFilled from '@mingcute/react/core-filled/menu'
import MinimizeRegular from '@mingcute/react/core-regular/minimize'
import MinimizeFilled from '@mingcute/react/core-filled/minimize'
import NotificationRegular from '@mingcute/react/core-regular/notification'
import NotificationFilled from '@mingcute/react/core-filled/notification'
import PauseRegular from '@mingcute/react/core-regular/pause'
import PauseFilled from '@mingcute/react/core-filled/pause'
import PlayRegular from '@mingcute/react/core-regular/play'
import PlayFilled from '@mingcute/react/core-filled/play'
import PlaylistRegular from '@mingcute/react/core-regular/playlist'
import PlaylistFilled from '@mingcute/react/core-filled/playlist'
import RepeatRegular from '@mingcute/react/core-regular/repeat'
import RepeatFilled from '@mingcute/react/core-filled/repeat'
import Search2Regular from '@mingcute/react/core-regular/search-2'
import Search2Filled from '@mingcute/react/core-filled/search-2'
import Settings3Regular from '@mingcute/react/core-regular/settings-3'
import Settings3Filled from '@mingcute/react/core-filled/settings-3'
import ShuffleRegular from '@mingcute/react/core-regular/shuffle'
import ShuffleFilled from '@mingcute/react/core-filled/shuffle'
import SkipForwardRegular from '@mingcute/react/core-regular/skip-forward'
import SkipForwardFilled from '@mingcute/react/core-filled/skip-forward'
import SkipPreviousRegular from '@mingcute/react/core-regular/skip-previous'
import SkipPreviousFilled from '@mingcute/react/core-filled/skip-previous'
import SquareRegular from '@mingcute/react/core-regular/square'
import SquareFilled from '@mingcute/react/core-filled/square'
import User3Regular from '@mingcute/react/core-regular/user-3'
import User3Filled from '@mingcute/react/core-filled/user-3'
import VolumeRegular from '@mingcute/react/core-regular/volume'
import VolumeFilled from '@mingcute/react/core-filled/volume'
import VolumeMuteRegular from '@mingcute/react/core-regular/volume-mute'
import VolumeMuteFilled from '@mingcute/react/core-filled/volume-mute'

export type MingCuteIconComp = ForwardRefExoticComponent<
  MingCuteIconProps & RefAttributes<SVGSVGElement>
>

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
  StrictMode,
  AddRegular,
  AddFilled,
  AlertRegular,
  AlertFilled,
  CaptionsRegular,
  CaptionsFilled,
  CheckRegular,
  CheckFilled,
  CloseRegular,
  CloseFilled,
  Delete2Regular,
  Delete2Filled,
  DownRegular,
  DownFilled,
  Download2Regular,
  Download2Filled,
  Earth4Regular,
  Earth4Filled,
  FolderRegular,
  FolderFilled,
  GithubRegular,
  GithubFilled,
  Home2Regular,
  Home2Filled,
  InformationRegular,
  InformationFilled,
  LinkRegular,
  LinkFilled,
  MenuRegular,
  MenuFilled,
  MinimizeRegular,
  MinimizeFilled,
  NotificationRegular,
  NotificationFilled,
  PauseRegular,
  PauseFilled,
  PlayRegular,
  PlayFilled,
  PlaylistRegular,
  PlaylistFilled,
  RepeatRegular,
  RepeatFilled,
  Search2Regular,
  Search2Filled,
  Settings3Regular,
  Settings3Filled,
  ShuffleRegular,
  ShuffleFilled,
  SkipForwardRegular,
  SkipForwardFilled,
  SkipPreviousRegular,
  SkipPreviousFilled,
  SquareRegular,
  SquareFilled,
  User3Regular,
  User3Filled,
  VolumeRegular,
  VolumeFilled,
  VolumeMuteRegular,
  VolumeMuteFilled,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
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
