import {
  Wifi, Globe, Cloud, Monitor, Server, HardDrive, Cpu, Database,
  Router, Plug, Radio, Satellite,
  User, Users, Building2, Briefcase, Shield, Crown,
  Wrench, Settings, Key, Lock, Terminal, Code, GitBranch, Bug,
  Zap, Send, RefreshCw, Activity, Gauge, BarChart3, ArrowRightLeft, Filter,
  Mail, MessageSquare, Phone, Bell,
  Box, Package, Layers, Folder, FileText, Archive, Clipboard, BookOpen,
  Star, Flag, Tag, AlertTriangle, CheckCircle, Eye, Lightbulb, Target,
} from 'lucide-react'

export const ICON_MAP = {
  Wifi, Globe, Cloud, Monitor, Server, HardDrive, Cpu, Database,
  Router, Plug, Radio, Satellite,
  User, Users, Building2, Briefcase, Shield, Crown,
  Wrench, Settings, Key, Lock, Terminal, Code, GitBranch, Bug,
  Zap, Send, RefreshCw, Activity, Gauge, BarChart3, ArrowRightLeft, Filter,
  Mail, MessageSquare, Phone, Bell,
  Box, Package, Layers, Folder, FileText, Archive, Clipboard, BookOpen,
  Star, Flag, Tag, AlertTriangle, CheckCircle, Eye, Lightbulb, Target,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export function getIcon(name) {
  return ICON_MAP[name] ?? Box
}
