/**
 * 飞鸟 · 品牌图标（方案 A：光点捕手）
 *
 * 源文件：brand/icon-a-spark.svg
 * 图形含义：一只飞掠的鸟（双翼）+ 喙前一颗橙色光点（被捕获的灵感）。
 * 底色自带深色圆角方块，因此在亮色/暗色主题下都能清晰显示，不依赖主题变量。
 *
 * 想换成方案 B（灯泡鸟）/ 方案 C（折纸鸟）：直接替换下面 <g> 里的路径即可，
 * 对应源文件在 brand/icon-b-bulb.svg、brand/icon-c-origami.svg。
 */
type LogoProps = {
  /** 图标边长，单位 px */
  size?: number
  className?: string
}

export default function Logo({ size = 34, className = '' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="飞鸟 · 你的灵感捕捉器"
      className={className}
    >
      {/* 圆角底板 */}
      <rect width="512" height="512" rx="112" fill="#0B1512" />
      <rect
        x="5"
        y="5"
        width="502"
        height="502"
        rx="107"
        fill="none"
        stroke="#1D9E75"
        strokeOpacity="0.35"
        strokeWidth="10"
      />
      <g transform="translate(256 252) scale(5.6) translate(-125.875 -116.25)">
        {/* 速度线 */}
        <path d="M92 108 L100 108" stroke="#1D9E75" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M90 120 L98 120" stroke="#1D9E75" strokeWidth="3.5" strokeLinecap="round" />
        {/* 鸟身（两道弧线构成双翼） */}
        <path
          d="M104 126 C114 112 121 112 127 124 C133 112 140 112 150 126"
          fill="none"
          stroke="#5DCAA5"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 被捕获的灵感光点 */}
        <circle cx="157" cy="110" r="6.5" fill="#EF9F27" />
      </g>
    </svg>
  )
}
