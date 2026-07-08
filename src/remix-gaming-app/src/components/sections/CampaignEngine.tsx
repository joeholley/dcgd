import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Megaphone, 
  Target, 
  CircleDollarSign, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  Globe, 
  Play, 
  Search, 
  Layers, 
  Gauge, 
  Bot, 
  ChevronRight, 
  Trash2,
  Share2,
  Eye,
  MousePointerClick,
  Chrome,
  TrendingUp,
  Sliders,
  Cable
} from "lucide-react";
import { collection, query, getDocs, orderBy, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth, isUsingFirebaseMock } from "../../services/firebase";
import { cn } from "../../lib/utils";
import { DataModeBadge } from "../DataModeBadge";
import { useDemoEvent } from "../../context/DemoEventContext";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


interface Campaign {
  id: string;
  name: string;
  cohort: string;
  game: string;
  propensity: number;
  originalBudget: number;
  aiBudget: number;
  message: string;
  isAiAdjusted: boolean;
  networks: string[];
  status: "Draft" | "Pending" | "Active";
  createdAt: string;
}

const PRESET_COHORTS = [
  {
    name: "Cosmic Raider Dormant Cohort",
    game: "Cosmic Raider RPG",
    propensity: 88,
    sampleInterest: "Legendary weapon drop models & gold incentives",
    defaultMessage: "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate! Grab it now in Cosmic Raider RPG."
  },
  {
    name: "Retro Speed Racer Churn-Risk",
    game: "Retro Speed Racer",
    propensity: 42,
    sampleInterest: "Daily gold tokens & cosmetic racer tracks",
    defaultMessage: "The track is clear and the engines are hot! Drag your Retro Speed Racer back today and claim 150 gold coins on us!"
  },
  {
    name: "Puzzle Quest Casual Spenders",
    game: "Puzzle Quest Saga",
    propensity: 95,
    sampleInterest: "Puzzle expansion levels & magic chests",
    defaultMessage: "Unlock the secret forest! The magic expansion pass for Puzzle Quest Saga is active. Start playing today with 25% off store wide."
  },
  {
    name: "Pixel Battle Royale Active Recruits",
    game: "Pixel Battle Royale",
    propensity: 64,
    sampleInterest: "Premium weapon skin tiers",
    defaultMessage: "Drop zone loaded! Grab the cyber ninja premium skin and dive into Pixel Battle Royale. Claim yours within 48 hours."
  }
];

export type Country = "Japan" | "Korea" | "China";
export type LanguageSetting = "en" | "local";

const TRANSLATIONS: Record<string, Record<Country, string>> = {
  // Game & Cohort Presets
  "Cosmic Raider RPG": { Japan: "Cosmic Raider RPG", Korea: "Cosmic Raider RPG", China: "Cosmic Raider RPG" },
  "Retro Speed Racer": { Japan: "Retro Speed Racer", Korea: "Retro Speed Racer", China: "Retro Speed Racer" },
  "Puzzle Quest Saga": { Japan: "Puzzle Quest Saga", Korea: "Puzzle Quest Saga", China: "Puzzle Quest Saga" },
  "Pixel Battle Royale": { Japan: "Pixel Battle Royale", Korea: "Pixel Battle Royale", China: "Pixel Battle Royale" },
  "Cosmic Raider Dormant Cohort": { Japan: "Cosmic Raider 休眠プレイヤー層", Korea: "Cosmic Raider 휴면 고객 코호트", China: "Cosmic Raider 流失玩家群组" },
  "Retro Speed Racer Churn-Risk": { Japan: "Retro Speed Racer 離脱リスク高層", Korea: "Retro Speed Racer 이탈 위험 코호트", China: "Retro Speed Racer 易流失玩家群组" },
  "Puzzle Quest Casual Spenders": { Japan: "Puzzle Quest 微課金層コホート", Korea: "Puzzle Quest 소액 결제 코호트", China: "Puzzle Quest 轻度付费群组" },
  "Pixel Battle Royale Active Recruits": { Japan: "Pixel Battle Royale アクティブ新規層", Korea: "Pixel Battle Royale 신규 활성 대원", China: "Pixel Battle Royale 活跃玩家群组" },
  "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate! Grab it now in Cosmic Raider RPG.": {
    Japan: "指揮官、再び宇宙を征服する準備はできていますか？レアなレジェンダリー・オブシディアンブレードがギフトボックスで待っています！Cosmic Raider RPGに今すぐログインしましょう。",
    Korea: "사령관님, 다시 우주를 지배할 준비가 되셨습니까? 보상 상자에 희귀한 전설 옵시디언 검이 잠들어 있습니다! Cosmic Raider RPG에서 지금 바로 수령하세요.",
    China: "指挥官，准备好再次征服星域了吗？稀有传奇曜石剑已在您的专属礼包箱中静候！立即登录 Cosmic Raider RPG 领取。"
  },
  "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate!": {
    Japan: "指揮官、再び宇宙を征服する準備はできていますか？レアなレジェンダリー・オブシディアンブレードがギフトボックスで待っています！",
    Korea: "사령관님, 다시 우주를 지배할 준비가 되셨습니까? 보상 상자에 희귀한 전설 옵시디언 검이 잠들어 있습니다!",
    China: "指挥官，准备好再次征服星域了吗？稀有传奇曜石剑已在您的专属礼包箱中静候！"
  },
  "The track is clear and the engines are hot! Drag your Retro Speed Racer back today and claim 150 gold coins on us!": {
    Japan: "コースはクリア、エンジンの準備も万端です！今日Retro Speed Racerに戻って、無料のゴールドコイン150枚を受け取りましょう！",
    Korea: "트랙이 열리고 엔진 열기가 뜨겁습니다! 오늘 Retro Speed Racer로 복귀하시고 보너스 150 골드 코인을 받아가세요!",
    China: "赛道已清空，引擎已轰鸣！今天重返 Retro Speed Racer，免费领取 150 金币！"
  },
  "The track is clear! Drag your Retro Speed Racer back today and claim 150 gold coins!": {
    Japan: "コースはクリア！今日Retro Speed Racerに戻って、無料のゴールドコイン150枚を受け取りましょう！",
    Korea: "트랙이 열렸습니다! 오늘 Retro Speed Racer로 복귀하시고 보너스 150 골드 코인을 받아가세요!",
    China: "赛道已开！今天重返 Retro Speed Racer，免费领取 150 金币！"
  },
  "Unlock the secret forest! The magic expansion pass for Puzzle Quest Saga is active. Start playing today with 25% off store wide.": {
    Japan: "秘密の森を解放しましょう！Puzzle Quest Saga de 魔法拡張パスが有効になりました。今なら全ストアアイテムが25%オフでプレイできます。",
    Korea: "비사회인 숲의 봉인을 해제하세요! Puzzle Quest Saga의 마법 확장 패스가 열렸습니다. 오늘 복구하시고 전 상점 25% 특별 할인 혜택도 받아보세요.",
    China: "解锁神秘森林！Puzzle Quest Saga 魔法拓展包已激活。今天重返游戏，即可享受全店 25% 专属特惠。"
  },
  "Drop zone loaded! Grab the cyber ninja premium skin and dive into Pixel Battle Royale. Claim yours within 48 hours.": {
    Japan: "降下ゾーンが読み込まれました！サイバーニンジャ・プレミアムスキンを手に入れて、Pixel Battle Royaleに飛び込みましょう。48時間以内に受け取ってください。",
    Korea: "강하 지역 로드 완료! 사이버 닌자 프리미엄 스킨을 장착하고 Pixel Battle Royale 전장으로 뛰어드세요. 48시간 내에 수령할 수 있습니다.",
    China: "空投区域已就绪！领取赛博忍者超凡皮肤，直接空降 Pixel Battle Royale。在 48 小时内完成领取。"
  },
  "Q2 Cosmic Retention Booster": {
    Japan: "Q2 Cosmic継続率向上ブースター",
    Korea: "Q2 Cosmic 리텐션 강화 부스터",
    China: "Q2 Cosmic 留存提升助力器"
  },
  "Q2 Cosmic Dormancy Recall": {
    Japan: "Q2 Cosmic休眠呼び戻しキャンペーン",
    Korea: "Q2 Cosmic 휴면 유저 복귀 유도",
    China: "Q2 Cosmic 流失流转召回"
  },
  "High-Spender Cosmic Reactivation": {
    Japan: "高額課金プレイヤーCosmic再活性化",
    Korea: "고액 결제자 Cosmic 재활성화",
    China: "高付费玩家 Cosmic 再次激活"
  },
  "Speed Racer Turbo Boost": {
    Japan: "Speed Racer ター보ブースト",
    Korea: "Speed Racer 터보 부스트",
    China: "Speed Racer 极速涡轮增压"
  },

  // Title
  "Dynamic Campaign & Marketing Engine": {
    Japan: "ダイナミック・キャンペーン＆マーケティング・エンジン",
    Korea: "동적 캠페인 및 마케팅 엔진",
    China: "动态广告活动与营销引擎"
  },
  "Automated cohort-targeted messaging & cross-network delivery triggers: Google Ads • Google Marketing": {
    Japan: "自動コホートターゲットメッセージングとクロスネットワーク配信トリガー：Google広告・Googleマーケティング",
    Korea: "자동화된 코호트 타겟 메시징 및 교차 네트워크 전송 트리거: Google 광고 • Google 마케팅",
    China: "自动群组客制化消息及跨网络投放触发器：Google 广告 • Google 营销"
  },
  "Total Active Audiences": {
    Japan: "アクティブオーディエンス総数",
    Korea: "총 활성 오디언스",
    China: "总活跃受众"
  },
  "Total Allocated Budget": {
    Japan: "割当予算総額",
    Korea: "총 할당 예산",
    China: "总分配预算"
  },
  "Campaign Parameters": {
    Japan: "キャンペーンパラメータ",
    Korea: "캠페인 매개변수",
    China: "广告活动参数"
  },
  "Hyperpersonalization Active": {
    Japan: "ハイパーパーソナライズ有効",
    Korea: "초개인화 활성화됨",
    China: "超个性化已启用"
  },
  "Campaign Identifier Name": {
    Japan: "キャンペーン識別名",
    Korea: "캠페인 식별 이름",
    China: "广告活动识别名称"
  },
  "Select Target Player Cohort": {
    Japan: "ターゲットプレイヤーコホートの選択",
    Korea: "대상 플레이어 코호트 선택",
    China: "选择目标玩家群组"
  },
  "Propensity": {
    Japan: "コンバージョン傾向",
    Korea: "전환 성향",
    China: "转换倾向"
  },
  "Interest": {
    Japan: "関心分野",
    Korea: "관심 분야",
    China: "兴趣偏好"
  },
  "Allocated Channel Budget ($USD)": {
    Japan: "割当チャネル予算（米ドル）",
    Korea: "할당된 채널 예산 ($USD)",
    China: "渠道分配预算（美元）"
  },
  "Channel budgets optimized based on conversion probability models.": {
    Japan: "コンバージョン確率モデルに基づいて最適化されたチャネル予算。",
    Korea: "전환 확률 모델을 기반으로 최적화된 채널 예산.",
    China: "基于转换概率模型优化的渠道预算。"
  },
  "AI Auto-Budget Balance": {
    Japan: "AI自動予算調整バランス",
    Korea: "AI 자동 예산 밸런스",
    China: "AI 自动预算平衡"
  },
  "Original Budget": {
    Japan: "元の予算",
    Korea: "원래 예산",
    China: "原始预算"
  },
  "Optimized Budget": {
    Japan: "最適化された予算",
    Korea: "최적화된 예산",
    China: "优化后预算"
  },
  "Hyper-Personalized Content Preview": {
    Japan: "ハイパーパーソナライズされたコンテンツプレビュー",
    Korea: "초개인화된 콘텐츠 미리보기",
    China: "超个性化内容预览"
  },
  "Customize targeted alert push copy...": {
    Japan: "ターゲット向けアラートプッシュコピーをカスタマイズ...",
    Korea: "타겟 알림 푸시 문구 맞춤 연출...",
    China: "自定义目标推送文案..."
  },
  "Publish Channels": {
    Japan: "配信チャネル",
    Korea: "게시 채널",
    China: "发布渠道"
  },
  "Marketing Core Audience Sync": {
    Japan: "マーケティングコアオーディエンス同期",
    Korea: "마케팅 코어 오디언스 동기화",
    China: "核心营销受众同步"
  },
  "Google Ads API Sync Client": {
    Japan: "Google広告API同期クライアント",
    Korea: "Google 광고 API 동기화 클라이언트",
    China: "Google 广告 API 同步客户端"
  },
  "Auto-push custom cohorts dynamically": {
    Japan: "カスタムコホートを動的に自動プッシュ",
    Korea: "맞춤형 코호트를 동적으로 자동 푸시",
    China: "动态自动推送自定义群组"
  },
  "Customer ID": {
    Japan: "顧客ID",
    Korea: "고객 ID",
    China: "客户 ID"
  },
  "Establish OAuth Client Sync": {
    Japan: "OAuthクライアント同期を確立",
    Korea: "OAuth 클라이언트 동기화 설정",
    China: "建立 OAuth 客户端同步"
  },
  "Verifying SDK Credentials...": {
    Japan: "SDK認証情報を検証中...",
    Korea: "SDK 자격 증명 확인 중...",
    China: "正在验证 SDK 凭据..."
  },
  "Client Integration Secure": {
     Japan: "クライアント統合完了（セキュア）",
     Korea: "클라이언트 통합 안전하게 완료됨",
     China: "客户端安全集成完毕"
  },
  "Google Ads Customer ID: ": {
    Japan: "Google広告顧客ID: ",
    Korea: "Google 광고 고객 ID: ",
    China: "Google 广告客户 ID: "
  },
  "When a campaign runs, target lists are compiled natively using federated Snowflake filters to securely synchronize target player handles dynamically.": {
    Japan: "キャンペーンが実行されると、Snowflakeフェデレーションフィルタを使用してターゲットリストがネイティブにコンパイルされ、ターゲットプレイヤーのハンドルが安全かつ動的に同期されます。",
    Korea: "캠페인 실행 시 Snowflake 연합 필터를 사용하여 대상 리스트가 내부적으로 컴파일되며 대상 플레이어 식별 정보가 안전하고 동적으로 동기화됩니다.",
    China: "当广告活动启动时，系统将使用联合 Snowflake 过滤器安全地本地编译目标列表，以动态同步目标玩家标识。"
  },
  "Google Ads Real-time Live Preview": {
    Japan: "Google広告 リアルタイム・ライブプレビュー",
    Korea: "Google 광고 실시간 미리보기",
    China: "Google 广告实时在线预览"
  },
  "Google Search Ad": {
    Japan: "Google検索広告",
    Korea: "Google 검색 광고",
    China: "Google 搜索广告"
  },
  "Display Banner": {
    Japan: "ディスプレイバナー",
    Korea: "디스플레이 배너",
    China: "展示栏广告"
  },
  "Sponsored": {
    Japan: "スポンサー",
    Korea: "스폰서",
    China: "赞助商广告"
  },
  "Official Recruits Special": {
    Japan: "オフィシャル特別キャンペーン",
    Korea: "공식 신규 특별 모집",
    China: "官方重返特别福利"
  },
  "★ Retrieve Premium Items": {
    Japan: "★ プレミアムアイテムを受け取る",
    Korea: "★ 프리미엄 아이템 받기",
    China: "★ 领取豪华道具"
  },
  "⚡ Active Code: RETENTION24": {
    Japan: "⚡ アクティブコード: RETENTION24",
    Korea: "⚡ 활성 코드: RETENTION24",
    China: "⚡ 激活码: RETENTION24"
  },
  "Google Display Net": {
    Japan: "Googleディスプレイネット",
    Korea: "Google 디스플레이 네트워크",
    China: "网研展示网络"
  },
  "EXCLUSIVE GIFT": {
    Japan: "限定ギフト",
    Korea: "독점 특별 선물",
    China: "专属尊享礼包"
  },
  "CLAIM CRATE": {
    Japan: "ギフト箱を受け取る",
    Korea: "보상 상자 수령",
    China: "领取补给箱"
  },
  "LTV Propensity": {
    Japan: "LTV傾向",
    Korea: "우량 가치 LTV 성향",
    China: "LTV 兑换倾向"
  },
  "Est. Reach": {
    Japan: "推定リーチ",
    Korea: "예상 도달범위",
    China: "预估曝光量"
  },
  "Sim. CTR": {
    Japan: "想定CTR",
    Korea: "예상 CTR",
    China: "模拟 CTR"
  },
  "Crate Claims": {
    Japan: "コンバージョン数",
    Korea: "수령 횟수",
    China: "模拟领取量"
  },
  "GA4 & DV360 Bid Modulator": {
    Japan: "GA4＆DV360入札モジュレーター",
    Korea: "GA4 및 DV360 입찰 조절기",
    China: "GA4 与 DV360 竞价调节器"
  },
  "GA4 Audience": {
    Japan: "GA4 オーディエンス",
    Korea: "GA4 오디언스",
    China: "GA4 受众"
  },
  "Synced 100%": {
    Japan: "同期率 100%",
    Korea: "동기화 완료 100%",
    China: "100% 成功同步"
  },
  "Dynamic Push Feed": {
    Japan: "ダイナミックプッシュフィード",
    Korea: "동적 푸시 피드",
    China: "动态推送信息流"
  },
  "DV360 Optimizer": {
    Japan: "DV360 オプティマイザ",
    Korea: "DV360 입찰최적화",
    China: "DV360 自动优化"
  },
  "Direct Bidding": {
    Japan: "直接入札",
    Korea: "직접 입찰 방식",
    China: "直接点击出价"
  },
  "Real-Time Bidding Multiplier": {
    Japan: "リアルタイム入札倍率",
    Korea: "실시간 입찰 승수",
    China: "实时竞价倍率"
  },
  "AI AUTOMATED CALIBRATION LOCKED": {
    Japan: "AI自動補正ロック完了",
    Korea: "AI 자동 조정 밸런스 고정됨",
    China: "AI 自动配准已锁定"
  },
  "Campaign Rollout Agent": {
    Japan: "キャンペーン配信自動エージェント",
    Korea: "캠페인 배포 자동 에이전트",
    China: "广告活动投放执行代理"
  },
  "Deploy Campaign via Agent →": {
    Japan: "エージェント経由でキャンペーンを配信 →",
    Korea: "에이전트를 통하여 캠페인 배포 →",
    China: "通过代理安全分发广告活动 →"
  },
  "Agent Deploying Campaign...": {
    Japan: "エージェントが配信処理中...",
    Korea: "에이전트가 캠페인을 배포 중입니다...",
    China: "代理正在执行广告活动分发..."
  },
  "Active Targeted Run Histories": {
    Japan: "配信済みターゲットキャンペーン履歴",
    Korea: "활성 타겟 캠페인 이력 관리",
    China: "已启动目标投放历史记录"
  },
  "Live operational campaigns targeting specific game titles": {
    Japan: "特定のゲームタイトルをターゲットとした、現在稼働中のライブキャンペーン",
    Korea: "특정 게임 타이틀을 타겟으로 실행된 실시간 라이브 캠페인 기록",
    China: "针对特定游戏内群组正在运行 of 动态投放"
  },
  "Campaign Name": {
    Japan: "キャンペーン名",
    Korea: "캠페인명",
    China: "广告活动名称"
  },
  "Segment / Title": {
    Japan: "セグメント / タイトル",
    Korea: "세그먼트 / 타이틀",
    China: "细分受众 / 游戏标题"
  },
  "Delivery Channels": {
    Japan: "配信チャネル",
    Korea: "전달 채널",
    China: "投放渠道"
  },
  "Propensity Score": {
    Japan: "コンバージョン傾向スコア",
    Korea: "전환 성향 점수",
    China: "转换倾向评分"
  },
  "Operating Budget": {
    Japan: "運用予算",
    Korea: "진행 예산",
    China: "运营预算"
  },
  "Actions": {
    Japan: "操作",
    Korea: "작업",
    China: "操作"
  },
  "AI Optimized": {
    Japan: "AI 最適化済み",
    Korea: "AI 최적화 완료",
    China: "AI 已完美优化"
  },
  "Google Analytics": {
    Japan: "Google Analytics",
    Korea: "Google 애널리틱스",
    China: "Google 分析"
  },
  "Google Ads": {
    Japan: "Google Ads",
    Korea: "Google 광고",
    China: "Google 广告"
  },
  "In-Game Push API": {
    Japan: "ゲーム内プッシュAPI",
    Korea: "인게임 푸시 API",
    China: "游戏内推送 API"
  },
  "Players": {
    Japan: "プレイヤー",
    Korea: "명의 플레이어",
    China: "位玩家"
  },
  "Sandbox Mode": {
    Japan: "サンドボックスモード",
    Korea: "샌드박스 모드",
    China: "沙箱测试模式"
  },
  "API Connected": {
    Japan: "API 接続完了",
    Korea: "API 연결됨",
    China: "API 已连接"
  },
  "Legendary weapon drop models & gold incentives": {
    Japan: "レジェンダリー武器ドロップモデルとゴールドインセンティブ",
    Korea: "전설 무기 드롭 모델 및 골드 혜택",
    China: "传奇武器掉落几率与金币激励"
  },
  "Daily gold tokens & cosmetic racer tracks": {
    Japan: "デイリーゴールドトークンと装飾用レイサーコース",
    Korea: "일일 골드 토큰 및 레이싱 트랙 치장품",
    China: "每日金币代币与限定赛道皮肤"
  },
  "Puzzle expansion levels & magic chests": {
    Japan: "パズル拡張レベルと魔法のチェスト",
    Korea: "퍼즐 확장 스테이지 및 마법 상자",
    China: "专属隐藏关卡与魔法宝箱"
  },
  "Premium weapon skin tiers": {
    Japan: "プレミアム武器スキンティア",
    Korea: "프리미엄 무기 스킨 등급",
    China: "高品级武器皮肤等级"
  },
  "[Step 1] Loading historical segment records from Snowflake for target cohort...": {
    Japan: "[ステップ 1] 対象のコホートについてSnowflakeから履歴記録セグメントを読み込み中...",
    Korea: "[단계 1] 대상 코호트에 대해 Snowflake에서 이력 세그먼트 레코드 로드 중...",
    China: "[第一步] 自 Snowflake 加载对应目标玩家群组的历史细分记录..."
  },
  "[Step 2] Resolving active player profiles inside Google Cloud AlloyDB cluster...": {
    Japan: "[ステップ 2] Google Cloud AlloyDBクラスタ内のアクティブなプレイヤープロファイルを解決中...",
    Korea: "[단계 2] Google Cloud AlloyDB 클러스터 내에서 활성 플레이어 프로필 확인 중...",
    China: "[第二步] 获取 Google Cloud AlloyDB 数据库集群中的活跃玩家配置档案..."
  },
  "[Step 3] Fetching Google Ads audience list IDs for mapping direct sync...": {
    Japan: "[ステップ 3] 直接同期用のマッピング用にGoogle広告のオーディエンスリストIDを取得中...",
    Korea: "[단계 3] 오디언스 일치 동기화를 위한 Google 광고 오디언스 리스트 ID 수집 중...",
    China: "[第三步] 获取 Google 广告受众匹配标识符以进行直接同步映射..."
  },
  "[Step 4] Pushing segment mapping to Google Analytics marketing scope...": {
    Japan: "[ステップ 4] セグメントマッピングをGoogle Analyticsマーケティングスコープにプッシュ中...",
    Korea: "[단계 4] 세그먼트 매핑 정보를 Google 애널리틱스 마케팅 제품군으로 전송 중...",
    China: "[第四步] 推送细分受众映射至 Google Analytics 分析营销范围..."
  },
  "[Step 5] Triggering dynamic personalizations using Jingle Games live telemetry API...": {
    Japan: "[ステップ 5] Jingle GamesライブテレメトリAPIを使用してダイナミックパーソナライズを実行中...",
    Korea: "[단계 5] Jingle Games 라이브 원격 분석 API를 사용한 동적 실시간 마케팅 트리거 작동 중...",
    China: "[第五步] 结合 Jingle Games 实时遥测 API 触发动态个性化内容..."
  },
  "[Success] Sync verified! Campaign synced successfully.": {
    Japan: "[成功] 同期完了！キャンペーンは正常に同期されました。",
    Korea: "[성공] 동기화 완료! 캠페인이 안전하게 동기화되었습니다.",
    China: "[成功] 同步成功验证！广告活动已完美同步上线。"
  },
  "Spinning up Campaign Rollout Orchestrator AI Node...": {
    Japan: "キャンペーン配信オーケストレータAIノードを起動中...",
    Korea: "캠페인 배포 오케스트레이터 AI 노드 가동 중...",
    China: "正在启动广告部署编排器 AI 节点..."
  }
};

function translateDynamicText(text: string, country: Country, setting: LanguageSetting): string {
  if (setting === "en" || !text) return text;

  if (TRANSLATIONS[text] && TRANSLATIONS[text][country]) {
    return TRANSLATIONS[text][country];
  }

  let translated = text;
  const replacers = [
    { enlist: "Cosmic Raider Dormant Cohort", JP: "Cosmic Raider 休眠コホート", KR: "Cosmic Raider 휴면 코호트", ZH: "Cosmic Raider 休眠玩家群组" },
    { enlist: "Retro Speed Racer Churn-Risk", JP: "Retro Speed Racer 離脱リスクコホート", KR: "Retro Speed Racer 이탈위험 코호트", ZH: "Retro Speed Racer 易流失群组" },
    { enlist: "Puzzle Quest Casual Spenders", JP: "Puzzle Quest 微課金コホート", KR: "Puzzle Quest 소액결제 코호트", ZH: "Puzzle Quest 轻度付费群组" },
    { enlist: "Pixel Battle Royale Active Recruits", JP: "Pixel Battle Royale 新規アクティブ", KR: "Pixel Battle Royale 신규활성", ZH: "Pixel Battle Royale 活跃玩家群组" },
    { enlist: "Cosmic Raider RPG", JP: "Cosmic Raider RPG", KR: "Cosmic Raider RPG", ZH: "Cosmic Raider RPG" },
    { enlist: "Retro Speed Racer", JP: "Retro Speed Racer", KR: "Retro Speed Racer", ZH: "Retro Speed Racer" },
    { enlist: "Puzzle Quest Saga", JP: "Puzzle Quest Saga", KR: "Puzzle Quest Saga", ZH: "Puzzle Quest Saga" },
    { enlist: "Pixel Battle Royale", JP: "Pixel Battle Royale", KR: "Pixel Battle Royale", ZH: "Pixel Battle Royale" }
  ];

  for (const item of replacers) {
    if (translated.includes(item.enlist)) {
      const replVal = country === "Japan" ? item.JP : country === "Korea" ? item.KR : item.ZH;
      translated = translated.replaceAll(item.enlist, replVal);
    }
  }

  return translated;
}

function GoogleAdsLivePreview({ 
  campaignName, 
  message, 
  game, 
  budget, 
  propensity,
  country = "Japan",
  languageSetting = "en"
}: { 
  campaignName: string; 
  message: string; 
  game: string; 
  budget: number; 
  propensity: number; 
  country?: Country;
  languageSetting?: LanguageSetting;
}) {
  const [activeTab, setActiveTab] = useState<"search" | "display">("search");
  
  const t = (text: string): string => {
    if (languageSetting === "en" || !text) return text;
    if (TRANSLATIONS[text] && TRANSLATIONS[text][country]) {
      return TRANSLATIONS[text][country];
    }
    return translateDynamicText(text, country, languageSetting);
  };

  // Calculate dynamic ad performance indicators based on target group propensity
  const estimatedCTR = (propensity * 0.12 + 2.5).toFixed(1);
  const estimatedClicks = Math.round((budget / 1.75) * (propensity / 100));
  const estimatedImpressions = Math.round(budget * (120 + propensity));

  return (
    <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Chrome className="w-4 h-4 text-sky-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider font-sans text-slate-300">{t("Google Ads Real-time Live Preview")}</span>
        </div>
        <div className="flex bg-slate-950 p-0.5 rounded-lg text-[9px] font-bold border border-white/5">
          <button 
            type="button" 
            onClick={() => setActiveTab("search")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-all cursor-pointer",
              activeTab === "search" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {t("Google Search Ad")}
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab("display")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-all cursor-pointer",
              activeTab === "display" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {t("Display Banner")}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "search" ? (
          <motion.div 
            key="searchAd"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-white text-slate-800 p-4 rounded-2xl border border-slate-100 shadow-inner space-y-2 text-left"
          >
            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
              <span>https://play.google.com/store/apps/{game.toLowerCase().replace(/\s/g, "-")}</span>
              <span>•</span>
              <span className="font-bold text-slate-850 flex items-center gap-1 text-blue-600">
                <span className="bg-blue-150 text-blue-700 font-sans font-black text-[7px] px-1 py-0.2 rounded">Ad</span> {t("Sponsored")}
              </span>
            </div>
            
            <h4 className="text-sm font-semibold text-blue-700 hover:underline leading-snug cursor-pointer">
              {t("Retrieve")} {t(game)}: {t(campaignName) || t("Official Recruits Special")}
            </h4>

            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              {t(message) || t("Re-encounter amazing battles and experience elite weapon enhancements. Sync in-game telemetry instantly.")}
            </p>

            <div className="flex gap-4 pt-1.5 border-t border-slate-100 text-[10px] text-blue-700 font-semibold">
              <span className="hover:underline cursor-pointer">{t("★ Retrieve Premium Items")}</span>
              <span className="hover:underline cursor-pointer">{t("⚡ Active Code: RETENTION24")}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="displayAd"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="relative overflow-hidden h-36 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-950 p-4 flex flex-col justify-between text-left border border-indigo-550/20"
          >
            {/* Design accents */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-28 h-20 bg-indigo-500/15 rounded-tl-full blur-lg pointer-events-none" />

            <div className="flex justify-between items-start z-10">
              <div>
                <span className="bg-slate-900/80 text-[8px] font-bold text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-widest border border-white/5 font-mono">
                  {t("Google Display Net")}
                </span>
                <h4 className="text-xs font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 mt-2">
                  {t(game)} {t("EXCLUSIVE GIFT")}
                </h4>
              </div>
              <span className="text-[8px] text-indigo-300 font-bold tracking-widest uppercase">LIVE PREVIEW</span>
            </div>

            <p className="text-[10px] text-slate-300 leading-normal max-w-[210px] font-mono z-10 truncate mb-1">
              {t(message)}
            </p>

            <div className="flex justify-between items-center z-10">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold">{t("LTV Propensity")}:</span>
                <span className="text-[9px] text-emerald-400 font-mono font-bold">{propensity}%</span>
              </div>
              <button type="button" className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:scale-105 active:scale-95 transition-all cursor-pointer">
                {t("CLAIM CRATE")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad Telemetry Matrix */}
      <div className="grid grid-cols-3 gap-3 pt-2 text-center border-t border-white/5 font-mono text-[10px]">
        <div className="bg-slate-950/40 p-2 rounded-xl">
          <p className="text-[8px] text-slate-500 uppercase font-sans mb-0.5">{t("Est. Reach")}</p>
          <p className="font-bold text-white text-xs">{estimatedImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-slate-950/40 p-2 rounded-xl">
          <p className="text-[8px] text-slate-400 uppercase font-sans mb-0.5">{t("Sim. CTR")}</p>
          <p className="font-bold text-blue-400 text-xs">{estimatedCTR}%</p>
        </div>
        <div className="bg-slate-950/40 p-2 rounded-xl">
          <p className="text-[8px] text-slate-400 uppercase font-sans mb-0.5">{t("Crate Claims")}</p>
          <p className="font-bold text-emerald-400 text-xs">~{estimatedClicks}</p>
        </div>
      </div>
    </div>
  );
}

function GoogleMarketingPlatformSuite({ 
  isAiActive, 
  cohortName, 
  propensity,
  country = "Japan",
  languageSetting = "en"
}: { 
  isAiActive: boolean; 
  cohortName: string; 
  propensity: number; 
  country?: Country;
  languageSetting?: LanguageSetting;
}) {
  const [manualBid, setManualBid] = useState(1.2);
  
  const t = (text: string): string => {
    if (languageSetting === "en" || !text) return text;
    if (TRANSLATIONS[text] && TRANSLATIONS[text][country]) {
      return TRANSLATIONS[text][country];
    }
    return translateDynamicText(text, country, languageSetting);
  };

  // AI automatically calibrates the dynamic real-time RTB bid multiplier
  const activeBidMultiplier = isAiActive 
    ? parseFloat((propensity >= 70 ? 1.85 : 0.65).toFixed(2))
    : manualBid;

  const sliderDesc = isAiActive 
    ? (languageSetting === "local"
        ? (country === "Japan" 
            ? `適応型アルゴリズムが、アクティブな ${propensity}% コンバージョン層をターゲットとする入札倍率を ${activeBidMultiplier}倍にロックします。`
            : country === "Korea"
              ? `자동 알고리즘이 활성화된 ${propensity}% 전환 그룹을 타겟팅하여 입찰 승수를 ${activeBidMultiplier}배로 고정합니다.`
              : `自适应算法将竞价倍率锁定为 ${activeBidMultiplier}x，以精准定位受众活跃度由 ${propensity}% 组成的转换群体。`
          )
        : `Adaptive algorithm locks bid multiplier to ${activeBidMultiplier}x targeting the active ${propensity}% conversion group.`
      )
    : t("Drag the slider to adjust real-time Google Marketing CPC multipliers manually.");

  return (
    <div className="bg-slate-50 text-slate-800 rounded-3xl border border-slate-200/60 p-5 space-y-4 text-left shadow-inner">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{t("GA4 & DV360 Bid Modulator")}</span>
        </div>
        {isAiActive ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 text-[8px] font-bold uppercase rounded border border-emerald-550/10 shrink-0">
            <Sparkles className="w-2.5 h-2.5" /> {t("AI Real-time Active")}
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-slate-200 text-slate-550 text-[8px] font-bold uppercase rounded">
            Manual Override
          </span>
        )}
      </div>

      {/* Network link visualization graph */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 relative overflow-hidden">
        <div className="flex justify-between items-center relative z-10">
          
          {/* GA4 side */}
          <div className="flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-center w-24 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-[6.5px] text-amber-700 font-bold uppercase tracking-tight mb-1 font-mono">{t("GA4 Audience")}</span>
            <p className="text-[9px] font-black text-slate-800 truncate w-full" title={t(cohortName)}>
              {t(cohortName).replace(" Cohort", "").replace(" Churn-Risk", "")}
            </p>
            <p className="text-[7.5px] text-slate-400 font-mono">{t("Synced 100%")}</p>
          </div>

          {/* Connected Stream dynamic arrows */}
          <div className="flex-1 flex flex-col items-center justify-center px-2 relative">
            <div className="w-full h-1 bg-slate-100 rounded relative overflow-hidden border border-slate-200">
              <motion.div 
                className="absolute inset-y-0 h-full bg-blue-500 rounded"
                initial={{ left: "0%", width: "10%" }}
                animate={{ left: ["0%", "100%"], width: ["10%", "30%", "10%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              />
            </div>
            <span className="text-[7px] font-mono text-blue-600 font-bold mt-1 uppercase tracking-tighter">
              {t("Dynamic Push Feed")}
            </span>
          </div>

          {/* DV360 side */}
          <div className="flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-center w-24 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-indigo-150 border border-indigo-200 text-[6.5px] text-indigo-700 font-bold uppercase tracking-tight mb-1 font-mono">{t("DV360 Optimizer")}</span>
            <p className="text-[9px] font-black text-slate-800">{t("Direct Bidding")}</p>
            <p className="text-[8px] text-emerald-600 font-mono font-black">{activeBidMultiplier}x Multiplier</p>
          </div>

        </div>
      </div>

      {/* Interactive Bid Modifier slider */}
      <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="flex justify-between text-[10px] font-bold text-slate-600">
          <span>{t("Real-Time Bidding Multiplier")}</span>
          <span className="font-mono text-blue-600 font-black">{activeBidMultiplier}x</span>
        </div>

        <div className="relative pt-1">
          <input 
            type="range"
            min="0.2"
            max="3.0"
            step="0.05"
            disabled={isAiActive}
            value={activeBidMultiplier}
            onChange={e => setManualBid(parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isAiActive && (
            <div className="absolute inset-x-0 bottom-0 bg-transparent flex items-center justify-center">
              <span className="text-[8px] bg-slate-950 text-white font-mono font-bold px-2 py-0.5 rounded shadow-sm border border-slate-800 opacity-95">
                {t("AI AUTOMATED CALIBRATION LOCKED")}
              </span>
            </div>
          )}
        </div>

        <p className="text-[8.5px] text-slate-400 leading-normal font-light italic">
          {sliderDesc}
        </p>
      </div>
    </div>
  );
}

export interface CampaignEngineProps {
  country?: Country;
  setCountry?: (c: Country) => void;
  languageSetting?: LanguageSetting;
  setLanguageSetting?: (l: LanguageSetting) => void;
}

export function CampaignEngine({
  country: propCountry,
  setCountry: propSetCountry,
  languageSetting: propLanguageSetting,
  setLanguageSetting: propSetLanguageSetting
}: CampaignEngineProps = {}) {
  const { latestChurnEvent } = useDemoEvent();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Localization States
  const [internalCountry, setInternalCountry] = useState<Country>("Japan");
  const [internalLanguageSetting, setInternalLanguageSetting] = useState<LanguageSetting>("en");

  const country = propCountry ?? internalCountry;
  const setCountry = propSetCountry ?? setInternalCountry;
  const languageSetting = propLanguageSetting ?? internalLanguageSetting;
  const setLanguageSetting = propSetLanguageSetting ?? setInternalLanguageSetting;
  
  // Form State
  const [campaignName, setCampaignName] = useState("Q2 Cosmic Retention Booster");
  const [selectedCohortIndex, setSelectedCohortIndex] = useState(0);
  const [budget, setBudget] = useState(2500);
  const [aiMode, setAiMode] = useState(true);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(["Google Ads", "Google Analytics"]);

  // Integration States
  const [adsConnected, setAdsConnected] = useState(false);
  const [googleAdsClientId, setGoogleAdsClientId] = useState("982-114-8742");
  const [isSyncingAds, setIsSyncingAds] = useState(false);

  // Agent Automation state
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [agentLog, setAgentLog] = useState<string[]>([]);

  const selectedCohort = PRESET_COHORTS[selectedCohortIndex];

  // Translation helpers inside React scope
  const t = (text: string): string => {
    if (languageSetting === "en" || !text) return text;
    if (TRANSLATIONS[text] && TRANSLATIONS[text][country]) {
      return TRANSLATIONS[text][country];
    }
    return translateDynamicText(text, country, languageSetting);
  };

  const formatCurrency = (val: number) => {
    if (languageSetting === "local") {
      if (country === "Japan") {
        return `¥${(val * 150).toLocaleString()}`;
      } else if (country === "Korea") {
        return `₩${(val * 1350).toLocaleString()}`;
      } else if (country === "China") {
        return `¥${(val * 7.2).toLocaleString()}`;
      }
    }
    return `$${val.toLocaleString()}`;
  };

  // Synchronize campaign name and message on localization toggling
  useEffect(() => {
    const isDefaultName = (name: string) => {
      if (name === "Q2 Cosmic Retention Booster" || name === "Q2 Cosmic Dormancy Recall") return true;
      const countries: Country[] = ["Japan", "Korea", "China"];
      for (const c of countries) {
        if (TRANSLATIONS["Q2 Cosmic Retention Booster"]?.[c] === name || TRANSLATIONS["Q2 Cosmic Dormancy Recall"]?.[c] === name) {
          return true;
        }
      }
      return false;
    };

    const findEnglishName = (name: string) => {
      if (name === "Q2 Cosmic Retention Booster" || name === "Q2 Cosmic Dormancy Recall") return name;
      const countries: Country[] = ["Japan", "Korea", "China"];
      for (const c of countries) {
        if (TRANSLATIONS["Q2 Cosmic Retention Booster"]?.[c] === name) return "Q2 Cosmic Retention Booster";
        if (TRANSLATIONS["Q2 Cosmic Dormancy Recall"]?.[c] === name) return "Q2 Cosmic Dormancy Recall";
      }
      return name;
    };

    if (isDefaultName(campaignName)) {
      const engName = findEnglishName(campaignName);
      if (languageSetting === "local") {
        setCampaignName(TRANSLATIONS[engName]?.[country] || engName);
      } else {
        setCampaignName(engName);
      }
    }

    const isDefaultMsg = (msg: string) => {
      if (PRESET_COHORTS.some(c => c.defaultMessage === msg)) return true;
      const countries: Country[] = ["Japan", "Korea", "China"];
      for (const preset of PRESET_COHORTS) {
        for (const c of countries) {
          if (TRANSLATIONS[preset.defaultMessage]?.[c] === msg) return true;
        }
      }
      return false;
    };

    const findEnglishMsg = (msg: string) => {
      if (PRESET_COHORTS.some(c => c.defaultMessage === msg)) return msg;
      const countries: Country[] = ["Japan", "Korea", "China"];
      for (const preset of PRESET_COHORTS) {
        for (const c of countries) {
          if (TRANSLATIONS[preset.defaultMessage]?.[c] === msg) return preset.defaultMessage;
        }
      }
      return msg;
    };

    if (isDefaultMsg(customMessage)) {
      const engMsg = findEnglishMsg(customMessage);
      if (languageSetting === "local") {
        setCustomMessage(TRANSLATIONS[engMsg]?.[country] || engMsg);
      } else {
        setCustomMessage(engMsg);
      }
    }
  }, [languageSetting, country]);

  // Set default message when cohort changes or is first loaded
  useEffect(() => {
    if (!customMessage || PRESET_COHORTS.some(c => c.defaultMessage === customMessage || !customMessage)) {
      const defaultMsg = selectedCohort.defaultMessage;
      if (languageSetting === "local") {
        setCustomMessage(TRANSLATIONS[defaultMsg]?.[country] || defaultMsg);
      } else {
        setCustomMessage(defaultMsg);
      }
    }
  }, [selectedCohortIndex]);

  // Load campaigns from Firestore
  const fetchCampaigns = async () => {
    setLoading(true);
    if (isUsingFirebaseMock) {
      setCampaigns([
        {
          id: "initial-raider-re-engage",
          name: "High-Spender Cosmic Reactivation",
          cohort: "Cosmic Raider Dormant Cohort",
          game: "Cosmic Raider RPG",
          propensity: 88,
          originalBudget: 4000,
          aiBudget: 5500,
          message: "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate!",
          isAiAdjusted: true,
          networks: ["Google Ads", "Google Analytics"],
          status: "Active",
          createdAt: new Date(Date.now() - 86450000).toISOString()
        },
        {
          id: "initial-speedy-promo",
          name: "Speed Racer Turbo Boost",
          cohort: "Retro Speed Racer Churn-Risk",
          game: "Retro Speed Racer",
          propensity: 42,
          originalBudget: 1500,
          aiBudget: 900,
          message: "The track is clear! Drag your Retro Speed Racer back today and claim 150 gold coins!",
          isAiAdjusted: true,
          networks: ["Google Ads"],
          status: "Active",
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ]);
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.LIST, "campaigns");
        return;
      }
      const fetched: Campaign[] = [];
      querySnapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as Campaign);
      });
      
      // If Firestore is empty, we set up initial seed records in local state
      if (fetched.length === 0) {
        setCampaigns([
          {
            id: "initial-raider-re-engage",
            name: "High-Spender Cosmic Reactivation",
            cohort: "Cosmic Raider Dormant Cohort",
            game: "Cosmic Raider RPG",
            propensity: 88,
            originalBudget: 4000,
            aiBudget: 5500,
            message: "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate!",
            isAiAdjusted: true,
            networks: ["Google Ads", "Google Analytics"],
            status: "Active",
            createdAt: new Date(Date.now() - 86450000).toISOString()
          },
          {
            id: "initial-speedy-promo",
            name: "Speed Racer Turbo Boost",
            cohort: "Retro Speed Racer Churn-Risk",
            game: "Retro Speed Racer",
            propensity: 42,
            originalBudget: 1500,
            aiBudget: 900,
            message: "The track is clear! Drag your Retro Speed Racer back today and claim 150 gold coins!",
            isAiAdjusted: true,
            networks: ["Google Ads"],
            status: "Active",
            createdAt: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
      } else {
        setCampaigns(fetched);
      }
    } catch (err) {
      console.error("Error loading campaigns:", err);
      setCampaigns([
        {
          id: "initial-raider-re-engage",
          name: "High-Spender Cosmic Reactivation",
          cohort: "Cosmic Raider Dormant Cohort",
          game: "Cosmic Raider RPG",
          propensity: 88,
          originalBudget: 4000,
          aiBudget: 5500,
          message: "Ready to conquer the stars again, Commander? A rare Legendary Obsidian Blade is waiting in your gift crate!",
          isAiAdjusted: true,
          networks: ["Google Ads", "Google Analytics"],
          status: "Active",
          createdAt: new Date(Date.now() - 86450000).toISOString()
        },
        {
          id: "initial-speedy-promo",
          name: "Speed Racer Turbo Boost",
          cohort: "Retro Speed Racer Churn-Risk",
          game: "Retro Speed Racer",
          propensity: 42,
          originalBudget: 1500,
          aiBudget: 900,
          message: "The track is clear! Drag your Retro Speed Racer back today and claim 150 gold coins!",
          isAiAdjusted: true,
          networks: ["Google Ads"],
          status: "Active",
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Handle saving campaign to Firestore
  const saveCampaign = async (newCamp: Omit<Campaign, "id">) => {
    if (isUsingFirebaseMock) {
      setCampaigns(prev => [
        { id: `mock-${Date.now()}`, ...newCamp },
        ...prev
      ]);
      return;
    }

    try {
      let docRef;
      try {
        docRef = await addDoc(collection(db, "campaigns"), newCamp);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, "campaigns");
        return;
      }
      fetchCampaigns();
    } catch (err) {
      console.error("Error saving campaign: ", err);
      setCampaigns(prev => [
        { id: Math.random().toString(), ...newCamp },
        ...prev
      ]);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (isUsingFirebaseMock) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      return;
    }

    try {
      try {
        await deleteDoc(doc(db, "campaigns", id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `campaigns/${id}`);
        return;
      }
      fetchCampaigns();
    } catch (err) {
      console.error("Error deleting campaign:", err);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    }
  };

  // Sync Google Ads credentials and launch oauth
  const handleConnectGoogleAds = () => {
    setIsSyncingAds(true);
    setTimeout(() => {
      setAdsConnected(true);
      setIsSyncingAds(false);
    }, 1500);
  };

  // Agentic Workflow Implementation
  const runAgentCampaignWorkflow = () => {
    setIsRunningAgent(true);
    setAgentStep(0);
    setAgentLog([
      "Spinning up Campaign Rollout Orchestrator AI Node...",
    ]);

    const stepLogs = [
      "[Step 1] Loading historical segment records from Snowflake for target cohort...",
      "[Step 2] Resolving active player profiles inside Google Cloud AlloyDB cluster...",
      "[Step 3] Fetching Google Ads audience list IDs for mapping direct sync...",
      "[Step 4] Pushing segment mapping to Google Analytics marketing scope...",
      "[Step 5] Triggering dynamic personalizations using Jingle Games live telemetry API...",
      "[Success] Sync verified! Campaign synced successfully."
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < stepLogs.length) {
        setAgentLog(prev => [...prev, stepLogs[current]]);
        setAgentStep(current + 1);
        current++;
      } else {
        clearInterval(interval);
        
        // Save Campaign on agent completion
        const originalVal = budget;
        // Calculation: AI boosts budgets for high propensities and scales down on lower ones
        const calculatedAiBudget = aiMode 
          ? Math.round(originalVal * (selectedCohort.propensity >= 70 ? 1.35 : 0.72))
          : originalVal;

        const campaignToSave: Omit<Campaign, "id"> = {
          name: campaignName,
          cohort: selectedCohort.name,
          game: selectedCohort.game,
          propensity: selectedCohort.propensity,
          originalBudget: originalVal,
          aiBudget: calculatedAiBudget,
          message: customMessage,
          isAiAdjusted: aiMode,
          networks: selectedNetworks,
          status: "Active",
          createdAt: new Date().toISOString()
        };

        saveCampaign(campaignToSave);
        setIsRunningAgent(false);
      }
    }, 1000);
  };

  const handleNetworkToggle = (net: string) => {
    if (selectedNetworks.includes(net)) {
      setSelectedNetworks(prev => prev.filter(n => n !== net));
    } else {
      setSelectedNetworks(prev => [...prev, net]);
    }
  };

  // Auto Calculations based on inputs
  const calculatedAiBudget = aiMode 
    ? Math.round(budget * (selectedCohort.propensity >= 70 ? 1.35 : 0.72))
    : budget;

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      {/* Regional Localization & Campaign Mapping Subsystem */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg shadow-slate-950/10 text-white">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400 animate-pulse" />
            <h3 className="text-sm font-bold tracking-tight uppercase font-mono">AdTech Regional Controller Hub</h3>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal font-light">
            Set regional target parameters to select predefined cohorts, auto-reindex financial currency assets, and toggle live localization overlays for copywriting.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto">
          <div className="flex flex-col gap-1.5 min-w-[160px] w-full sm:w-auto text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target Market Region</span>
            <div className="relative">
              <select
                id="country-selector"
                value={country}
                onChange={e => {
                  const val = e.target.value as Country;
                  setCountry(val);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Japan">🇯🇵 Japan (日本)</option>
                <option value="Korea">🇰🇷 Korea (대한민국)</option>
                <option value="China">🇨🇳 China (中国)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4 min-w-[150px] w-full sm:w-auto text-left">
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Localization Overlay</span>
             <div className="flex items-center gap-3 h-9">
               <span className={cn("text-[10px] font-bold transition-colors font-mono", languageSetting === "en" ? "text-blue-400" : "text-slate-500")}>ENGLISH</span>
               <button 
                 id="language-translator-toggle"
                 type="button"
                 onClick={() => setLanguageSetting(languageSetting === "en" ? "local" : "en")}
                 className={cn(
                   "w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0",
                   languageSetting === "local" ? "bg-blue-500" : "bg-slate-700"
                 )}
               >
                 <div className={cn(
                   "bg-white w-4 h-4 rounded-full shadow transition-transform",
                   languageSetting === "local" ? "translate-x-5" : "translate-x-0"
                 )} />
               </button>
               <span className={cn("text-[10px] font-bold transition-colors font-mono uppercase", languageSetting === "local" ? "text-blue-400" : "text-slate-500")}>
                 {country === "Japan" ? "日本語" : country === "Korea" ? "한국어" : "简体中文"}
               </span>
             </div>
          </div>
        </div>
      </div>

      {/* LiveOps Churn Alert Notification Banner */}
      {latestChurnEvent && (
        <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                LiveOps Guardrail Churn Alert Received
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-700 font-mono text-[10px]">{(latestChurnEvent.churnProbability * 100).toFixed(0)}% Churn Risk</span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Targeting high-churn {latestChurnEvent.payerTier} player <code>{latestChurnEvent.playerId}</code>. Pre-populating Campaign Engine with recommended offer: <strong>{latestChurnEvent.recommendedOffer}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCampaignName(`Recovery: ${latestChurnEvent.playerId}`);
              setCustomMessage(`Special ${latestChurnEvent.payerTier} Offer for ${latestChurnEvent.playerId}: Claim ${latestChurnEvent.recommendedOffer} before expiration!`);
              setBudget(3500);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Auto-Fill Recovery Campaign
          </button>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="text-left">
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight font-sans">
              {t("Dynamic Campaign & Marketing Engine")}
            </h2>
            <DataModeBadge mode="mock" source="In-Memory Dev Mock / Firestore" details="Local dev fallback with Firestore campaign state" />
          </div>
          <p className="text-slate-500 font-light text-sm italic">
            {t("Automated cohort-targeted messaging & cross-network delivery triggers: Google Ads • Google Marketing")}
          </p>
        </div>

        {/* Global Stats bar */}
        <div className="flex gap-4">
          <div className="p-4 px-6 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t("Total Active Audiences")}</p>
            <p className="text-xl font-mono text-slate-800 font-bold">{campaigns.length * 4200}+ {t("Players")}</p>
          </div>
          <div className="p-4 px-6 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t("Total Allocated Budget")}</p>
            <p className="text-xl font-mono text-emerald-600 font-bold">
              {formatCurrency(campaigns.reduce((acc, curr) => acc + (curr.isAiAdjusted ? curr.aiBudget : curr.originalBudget), 0))}
            </p>
          </div>
        </div>
      </header>

      {/* Main interactive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left column: Builder & controls */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("Campaign Parameters")}</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-[9px] font-bold uppercase">
                <Sparkles className="w-3 h-3" /> {t("Hyperpersonalization Active")}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">{t("Campaign Identifier Name")}</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="E.g. Q2 Cosmic Dormancy Recall"
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 ring-blue-500/10 transition-all text-slate-800"
                />
              </div>

              {/* Cohort selection */}
              <div className="text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">{t("Select Target Player Cohort")}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_COHORTS.map((cohort, index) => {
                    const isSelected = selectedCohortIndex === index;
                    return (
                      <button
                        key={cohort.name}
                        onClick={() => setSelectedCohortIndex(index)}
                        className={cn(
                          "p-4 rounded-2xl border text-left cursor-pointer transition-all space-y-2",
                          isSelected 
                            ? "bg-blue-50 text-blue-900 border-blue-200 shadow-md shadow-blue-500/5" 
                            : "bg-white text-slate-700 border-slate-100 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">{t(cohort.game)}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                            cohort.propensity >= 70 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {t("Propensity")}: {cohort.propensity}%
                          </span>
                        </div>
                        <h4 className="text-xs font-bold truncate leading-relaxed">{t(cohort.name)}</h4>
                        <p className="text-[10px] text-slate-400 font-light truncate">{t("Interest")}: {t(cohort.sampleInterest)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Budget controls & AI toggle */}
              <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {languageSetting === "local" 
                      ? (country === "Japan" ? "割当チャネル予算（日本円 ¥）" : country === "Korea" ? "할당된 채널 예산 (원화 ₩)" : "渠道分配预算（人民币 ¥）")
                      : t("Allocated Channel Budget ($USD)")
                    }
                  </label>
                  <div className="flex items-center gap-3 bg-white p-3 border border-slate-100 rounded-xl">
                    <span className="text-slate-400 font-sm font-bold">
                      {languageSetting === "local" ? (country === "Japan" || country === "China" ? "¥" : "₩") : "$"}
                    </span>
                    <input 
                      type="number"
                      value={budget}
                      onChange={e => setBudget(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-transparent border-none outline-none font-mono text-sm text-slate-800"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-light italic">{t("Channel budgets optimized based on conversion probability models.")}</p>
                </div>

                <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t("AI Auto-Budget Balance")}</span>
                    </div>
                    {/* Switch Toggle */}
                    <button 
                      onClick={() => setAiMode(!aiMode)}
                      className={cn(
                        "w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer",
                        aiMode ? "bg-blue-600" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "bg-white w-5 h-5 rounded-full shadow transition-transform",
                        aiMode ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{t("Original Budget")}:</span>
                      <span className="font-mono font-medium text-slate-700">{formatCurrency(budget)}</span>
                    </div>
                    <div className="flex justify-between text-xs items-center pt-1 border-t border-slate-50">
                      <span className="font-bold text-slate-800">{t("Optimized Budget")}:</span>
                      <AnimatePresence mode="wait">
                        <motion.span 
                          key={calculatedAiBudget}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={cn(
                            "font-mono font-bold",
                            aiMode ? "text-emerald-600 text-sm" : "text-slate-700"
                          )}
                        >
                          {formatCurrency(calculatedAiBudget)}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personalization editor */}
              <div className="text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  {t("Hyper-Personalized Content Preview")}
                </label>
                <textarea 
                  rows={3}
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 ring-blue-500/10 transition-all text-slate-700 leading-relaxed font-mono"
                  placeholder={t("Customize targeted alert push copy...")}
                />
              </div>

              {/* Channel Delivery Integration */}
              <div className="text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">{t("Publish Channels")}</label>
                <div className="flex gap-3">
                  {["Google Ads", "Google Analytics", "In-Game Push API"].map(network => {
                    const isSelected = selectedNetworks.includes(network);
                    return (
                      <button
                        key={network}
                        onClick={() => handleNetworkToggle(network)}
                        className={cn(
                          "flex-1 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          isSelected 
                            ? "bg-slate-900 text-white border-slate-900" 
                            : "bg-white text-slate-400 border-slate-200 hover:border-slate-350"
                        )}
                      >
                        {t(network)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: API Integrations & Agentic Trace */}
        <div className="lg:col-span-5 space-y-8">
          {/* AdTech Connections Sandbox */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> {t("Marketing Core Audience Sync")}
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">{t("Google Ads API Sync Client")}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{t("Auto-push custom cohorts dynamically")}</p>
                  </div>
                  <span className={cn(
                    "text-[8px] px-2 py-0.5 rounded uppercase font-bold",
                    adsConnected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {adsConnected ? t("API Connected") : t("Sandbox Mode")}
                  </span>
                </div>

                {!adsConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-150 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{t("Customer ID")}:</span>
                      <input 
                        type="text" 
                        value={googleAdsClientId}
                        onChange={e => setGoogleAdsClientId(e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-mono text-xs text-slate-700" 
                      />
                    </div>
                    <button
                      onClick={handleConnectGoogleAds}
                      disabled={isSyncingAds}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSyncingAds ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t("Verifying SDK Credentials...")}
                        </>
                      ) : (
                        <>
                          {t("Establish OAuth Client Sync")}
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-emerald-100 rounded-xl flex items-center gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                     <div className="space-y-0.5 text-left">
                        <p className="text-[10px] font-bold text-emerald-800">{t("Client Integration Secure")}</p>
                        <p className="text-[9px] text-slate-400 font-mono">{t("Google Ads Customer ID: ")}{googleAdsClientId}</p>
                     </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50/40 rounded-2xl border border-blue-100 text-left">
                <Target className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-[11px] text-blue-900 leading-relaxed font-light">
                  {t("When a campaign runs, target lists are compiled natively using federated Snowflake filters to securely synchronize target player handles dynamically.")}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Live Google Ads Simulation Widget */}
          <GoogleAdsLivePreview 
            campaignName={campaignName}
            message={customMessage}
            game={selectedCohort.game}
            budget={budget}
            propensity={selectedCohort.propensity}
            country={country}
            languageSetting={languageSetting}
          />

          {/* Interactive Live GA4 and DV360 Bid Modulator Mapping */}
          <GoogleMarketingPlatformSuite 
            isAiActive={aiMode}
            cohortName={selectedCohort.name}
            propensity={selectedCohort.propensity}
            country={country}
            languageSetting={languageSetting}
          />

          {/* Agentic Workflow Campaign Deployer */}
          <div className="p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
            
            <div className="relative z-10 space-y-6 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-85">{t("Campaign Rollout Agent")}</span>
                </div>
                {isRunningAgent && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[9px] font-bold uppercase tracking-tighter">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Live Trace
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-350 leading-relaxed font-light">
                {country === "Japan" && languageSetting === "local" 
                  ? "Google広告管理ツールを認証し、リアルタイムでプレイヤー層一覧を抽出し、ターゲットメッセージ翻訳表を最適化後、ライブトリガーを配信します。"
                  : country === "Korea" && languageSetting === "local"
                    ? "독립적인 자동 배포 에이전트를 가동하여 Google Ad Manager 인증 수령 및 실시간 코호트 인덱스를 로드하고 개인화된 메시지 전송 모듈을 안전하게 트리깅시킵니다."
                    : country === "China" && languageSetting === "local"
                      ? "触发我们的自主分发代理，安全验证 Google 广告管理工具、拉取实时受众索引、超个性化文案矩阵并安全分发在线触发器。"
                      : "Trigger our autonomous delivery agent to authenticate Google Ad Manager, pull real-time cohort indexes, hyper-personalize message matrices, and dispatch live triggers safely."
                }
              </p>

              {/* Step Traces */}
              {agentLog.length > 0 && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 font-mono text-[10px] space-y-2 text-slate-400 max-h-48 overflow-y-auto">
                   {agentLog.map((log, index) => (
                     <div key={index} className={cn(
                       "flex items-start gap-2",
                       index === agentLog.length - 1 ? "text-blue-400 font-bold" : "text-slate-450"
                     )}>
                        <div className="mt-1 w-1 h-1 rounded-full bg-blue-500" />
                        <span>{t(log)}</span>
                     </div>
                   ))}
                </div>
              )}

              <button
                onClick={runAgentCampaignWorkflow}
                disabled={isRunningAgent}
                className="w-full py-4 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRunningAgent ? t("Agent Deploying Campaign...") : t("Deploy Campaign via Agent →")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section: Dynamic History of Active Campaigns */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1 text-left">
            <h3 className="text-lg font-bold text-slate-800">{t("Active Targeted Run Histories")}</h3>
            <p className="text-xs text-slate-500">{t("Live operational campaigns targeting specific game titles")}</p>
          </div>
          <button 
            type="button"
            onClick={fetchCampaigns}
            className="p-3 bg-slate-50 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition-all cursor-pointer text-slate-400 font-bold"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="pb-4 text-left">{t("Campaign Name")}</th>
                  <th className="pb-4 text-left">{t("Segment / Title")}</th>
                  <th className="pb-4 text-left">{t("Delivery Channels")}</th>
                  <th className="pb-4 text-left">{t("Propensity Score")}</th>
                  <th className="pb-4 text-left">{t("Operating Budget")}</th>
                  <th className="pb-4 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.map((camp) => {
                  const activeBudget = camp.isAiAdjusted ? camp.aiBudget : camp.originalBudget;
                  const scoreLabel = languageSetting === "local"
                    ? (country === "Japan" ? "の確率" : country === "Korea" ? "의 확률" : "的可能性")
                    : "% Likelihood";
                  return (
                    <tr key={camp.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-left">
                        <p className="text-sm font-bold text-slate-800">{t(camp.name)}</p>
                        <p className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-xs block mt-0.5" title={t(camp.message)}>
                          "{t(camp.message)}"
                        </p>
                      </td>
                      <td className="py-4 text-left">
                        <p className="text-xs font-semibold text-slate-700">{t(camp.cohort)}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t(camp.game)}</p>
                      </td>
                      <td className="py-4 text-left">
                        <div className="flex flex-wrap gap-1">
                          {camp.networks.map(net => (
                            <span key={net} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[8px] font-semibold text-slate-600">
                              {t(net)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 text-left">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            camp.propensity >= 70 ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          )} />
                          <span className="text-xs font-bold text-slate-800">
                            {camp.propensity}{scoreLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-left">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-xs font-bold text-slate-800">{formatCurrency(activeBudget)}</span>
                          {camp.isAiAdjusted && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[8px] font-bold text-emerald-600 uppercase">
                              {t("AI Optimized")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="p-2 text-slate-350 hover:text-red-500 transparent cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
