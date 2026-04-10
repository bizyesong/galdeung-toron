/**
 * LLM 프롬프트에 넣는 허용 아이콘 목록.
 * 프론트는 import("lucide-react")로 동적 로드하므로 이름만 lucide와 일치하면 됨.
 */
export const LUCIDE_ICON_PROMPT_BLOCK = `
반드시 iconName에는 아래 목록 중 하나만 사용 (정확한 PascalCase 철자):
【IT·기술】 Laptop, Smartphone, Monitor, Cpu, Database, Server, Cloud, Code, Terminal, Wifi, HardDrive, Cable, Bug, Wrench, Glasses
【돈·투자】 DollarSign, TrendingUp, TrendingDown, Coins, PiggyBank, Briefcase, Landmark, Wallet, CreditCard, Banknote, Bitcoin, Receipt, Calculator
【연애·감성】 Heart, HeartHandshake, Smile, Flower2, Gift, Music, Moon, Coffee, Wine, Droplets
【논리·팩폭·분석】 Brain, Scale, FileText, AlertTriangle, Lightbulb, Microscope, Target, ListChecks, Sigma, BookOpen, Gavel, Eye
【부정·절약·리스크】 XCircle, Ban, ShieldAlert, ThumbsDown, Skull, Flame, Lock, OctagonAlert
【생활·여행】 MapPin, Home, Utensils, Plane, Luggage, Compass, Mountain, Ship, Car, Train, Tent, Camera, Sun
【사람·조직】 Users, UserRound, Handshake, Building2, Medal, Trophy
【기타】 Zap, Compass, Globe, Timer, Calendar, Newspaper, Pill, Stethoscope
`.trim();
