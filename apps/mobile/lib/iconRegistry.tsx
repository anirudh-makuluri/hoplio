import type { Icon, IconWeight } from 'phosphor-react-native';
import {
	Article,
	ArrowClockwise,
	CalendarBlank,
	CalendarPlus,
	CaretLeft,
	CaretRight,
	ChatsCircle,
	Check,
	CheckCircle,
	CircleHalf,
	Clock,
	DotsThreeVertical,
	File,
	GoogleLogo,
	House,
	Image,
	Info,
	List,
	Lock,
	LockOpen,
	MagnifyingGlass,
	PaperPlaneTilt,
	PencilSimple,
	Plus,
	Robot,
	ShieldCheck,
	SignOut,
	Smiley,
	Star,
	Trash,
	User,
	UserPlus,
	Users,
	UsersThree,
	WarningCircle,
	WifiSlash,
	X,
} from 'phosphor-react-native';

type IconEntry = {
	Icon: Icon;
	weight?: IconWeight;
};

/** Maps legacy Material icon names (and Phosphor keys) to Phosphor components. */
export const iconRegistry: Record<string, IconEntry> = {
	menu: { Icon: List },
	close: { Icon: X },
	home: { Icon: House },
	'account-multiple': { Icon: Users, weight: 'fill' },
	'account-multiple-outline': { Icon: Users, weight: 'regular' },
	'account-group': { Icon: UsersThree, weight: 'fill' },
	'account-multiple-plus': { Icon: UsersThree, weight: 'fill' },
	'account-outline': { Icon: User, weight: 'regular' },
	account: { Icon: User, weight: 'fill' },
	'account-plus': { Icon: UserPlus },
	'account-search-outline': { Icon: MagnifyingGlass },
	logout: { Icon: SignOut },
	chat: { Icon: ChatsCircle, weight: 'fill' },
	'chat-outline': { Icon: ChatsCircle, weight: 'regular' },
	'shield-lock': { Icon: ShieldCheck, weight: 'fill' },
	'shield-lock-outline': { Icon: ShieldCheck, weight: 'regular' },
	plus: { Icon: Plus, weight: 'bold' },
	'wifi-off': { Icon: WifiSlash },
	google: { Icon: GoogleLogo, weight: 'fill' },
	magnify: { Icon: MagnifyingGlass },
	'image-edit-outline': { Icon: PencilSimple },
	check: { Icon: Check, weight: 'bold' },
	pencil: { Icon: PencilSimple },
	'theme-light-dark': { Icon: CircleHalf },
	'robot-happy-outline': { Icon: Robot },
	'chevron-right': { Icon: CaretRight, weight: 'bold' },
	'chevron-left': { Icon: CaretLeft, weight: 'bold' },
	'file-outline': { Icon: File },
	file: { Icon: File, weight: 'fill' },
	star: { Icon: Star, weight: 'fill' },
	'star-outline': { Icon: Star, weight: 'regular' },
	'star-off-outline': { Icon: Star, weight: 'regular' },
	'emoticon-happy-outline': { Icon: Smiley },
	delete: { Icon: Trash },
	refresh: { Icon: ArrowClockwise },
	'dots-vertical': { Icon: DotsThreeVertical, weight: 'bold' },
	'clock-outline': { Icon: Clock },
	clock: { Icon: Clock, weight: 'fill' },
	'clock-plus': { Icon: CalendarPlus },
	'text-box-outline': { Icon: Article },
	lock: { Icon: Lock, weight: 'fill' },
	'lock-outline': { Icon: Lock },
	'lock-open-variant-outline': { Icon: LockOpen, weight: 'regular' },
	send: { Icon: PaperPlaneTilt, weight: 'fill' },
	'alert-circle-outline': { Icon: WarningCircle },
	image: { Icon: Image, weight: 'fill' },
	'check-circle': { Icon: CheckCircle, weight: 'fill' },
	calendar: { Icon: CalendarBlank },
	information: { Icon: Info, weight: 'fill' },
	'alert-circle': { Icon: WarningCircle, weight: 'fill' },
};

export function resolveIconWeight(name: string, explicitWeight?: IconWeight): IconWeight {
	if (explicitWeight) {
		return explicitWeight;
	}

	const entry = iconRegistry[name];
	if (entry?.weight) {
		return entry.weight;
	}

	if (name.includes('outline')) {
		return 'regular';
	}

	return 'regular';
}
