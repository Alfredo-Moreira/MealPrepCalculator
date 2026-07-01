/**
 * Meal Prep Calculator — icon pack
 *
 * Hand-authored to match the brand identity board (calm-wellness, "macro ring + leaf").
 * Conventions:
 *  - 24x24 viewBox, fill="none", stroke="currentColor" so icons inherit text color and theme.
 *  - 1.8 stroke, round caps/joins for a soft, organic feel.
 *  - BrandMark + BrandLockup are filled and use the brand color directly.
 *
 * Usage:  <LeafIcon className="w-5 h-5 text-emerald-700" />
 *         <BrandMark className="w-8 h-8" />   // ring + leaf, monochrome (currentColor)
 */
import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Brand marks
 * ------------------------------------------------------------------ */

/** Monochrome ring + leaf mark (inherits currentColor). Good for headers. */
export function BrandMark({ size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M16 11c-3.6 3-3.6 7.2 0 10.2 3.6-3 3.6-7.2 0-10.2Z" fill="currentColor" />
    </svg>
  );
}

/** Full color brand lockup tile (matches favicon / app-icon panel). */
export function BrandTile({ size = 32, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="64" height="64" rx="16" fill="#2E7D5B" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#FFFFFF" strokeWidth="4.5" />
      <path d="M32 22.5c-6 5-6 12 0 17 6-5 6-12 0-17Z" fill="#FFFFFF" />
      <path d="M32 25v12" stroke="#2E7D5B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Navigation / app chrome
 * ------------------------------------------------------------------ */

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const DatabaseIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
    <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

/* ------------------------------------------------------------------ *
 * Food / nutrition
 * ------------------------------------------------------------------ */

export const LeafIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14Z" />
    <path d="M5 19c3-6 6.5-9.5 11-11" />
  </Icon>
);

export const BowlIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10h18" />
    <path d="M4 10a8 8 0 0 0 16 0" />
    <path d="M9 10c0-2 1-3.5 3-3.5s3 1.5 3 3.5" />
  </Icon>
);

export const UtensilsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3v8M5 3v5a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V3M7 11v10" />
    <path d="M17 3c-1.7 0-3 2-3 5s1 4 3 4v9" />
  </Icon>
);

/** Macro ring / donut — overall macro split. */
export const MacroRingIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3.5v5M20.5 12h-5" />
  </Icon>
);

/** Calories — flame. */
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c3 3 4.5 5.5 4.5 8.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 9 9 7 12 3Z" />
    <path d="M12 21a4 4 0 0 0 4-4c0-1.7-1.3-3-2-4-1 1.5-2 1.7-2 0-1 1-2 2.3-2 4a4 4 0 0 0 2 4Z" />
  </Icon>
);

/** Protein — drumstick. */
export const ProteinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 5a4 4 0 0 1 5.6 5.6c-1.3 1.3-3.2 1.4-4.7.6l-2.8 2.8 1 1a2 2 0 1 1-2.8 2.8 2 2 0 1 1-2.8-2.8l1-1-2.8-2.8" />
    <path d="M13 5 7.9 10.1c-.8-1.5-.7-3.4.6-4.7A4 4 0 0 1 13 5Z" />
  </Icon>
);

/** Carbs — wheat. */
export const CarbsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21V9" />
    <path d="M12 9c0-2-1.3-3.5-3-4 .2 2 .9 3.4 3 4Z" />
    <path d="M12 9c0-2 1.3-3.5 3-4-.2 2-.9 3.4-3 4Z" />
    <path d="M12 14c0-2-1.3-3.5-3-4 .2 2 .9 3.4 3 4Z" />
    <path d="M12 14c0-2 1.3-3.5 3-4-.2 2-.9 3.4-3 4Z" />
  </Icon>
);

/** Fat — droplet. */
export const FatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c3.5 4 5.5 6.7 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.7 8.5 7 12 3Z" />
  </Icon>
);

/* ------------------------------------------------------------------ *
 * Profile / goals
 * ------------------------------------------------------------------ */

/** Biometrics — scale. */
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="3" />
    <path d="M12 8a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3Z" />
    <path d="M12 8V5.5" />
  </Icon>
);

/** Fitness goal — target. */
export const TargetIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Icon>
);

/** Activity — dumbbell. */
export const DumbbellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Icon>
);

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
    <path d="M5 19h14" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 19h14" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4 11.5-11.5Z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5 10 17.5 19 6.5" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5v2" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5h3l1.5-2h7L18 8.5h2a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.2" />
  </Icon>
);

export const BarcodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6v12M7 6v12M10 6v9M13 6v12M16 6v9M20 6v12" />
  </Icon>
);
