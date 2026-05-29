export function FirstCrackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Grano arábica: forma ovalada simétrica, ligeramente inclinada */}
      <path
        d="M16 3 C10 3 5 8.5 5 16 C5 23.5 10 29 16 29 C22 29 27 23.5 27 16 C27 8.5 22 3 16 3 Z"
        fill="currentColor"
        transform="rotate(-10 16 16) scale(0.72) translate(4.5 4.5)"
      />

      {/* Forma del grano más precisa — elipse arábica */}
      <ellipse
        cx="15"
        cy="16"
        rx="6"
        ry="10"
        transform="rotate(-8 15 16)"
        fill="currentColor"
      />

      {/* Surco central del grano arábica (línea característica) */}
      <path
        d="M12.5 7.5 Q13.5 11 13 14 Q12.5 17 12 20 Q11.5 22.5 12.5 24.5"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* PRIMER CRACK — grieta que quiebra el grano */}
      <path
        d="M15 11 L18 9 L16.5 13 L20 12"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Rayos de energía / vapor saliendo */}
      <line x1="19" y1="8" x2="22" y2="5.5"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
      <line x1="21" y1="11.5" x2="25" y2="10.5"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="20.5" y1="15" x2="24" y2="15.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />

      {/* Chispas */}
      <circle cx="23" cy="6.5" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="26" cy="10" r="0.85" fill="currentColor" opacity="0.6" />
      <circle cx="21.5" cy="4.5" r="0.7" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
