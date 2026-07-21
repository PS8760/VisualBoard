export const VisualBoard = () => {
    return (
        <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="visualboard-gradient" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stop-color="#A855F7" />
                    <stop offset="100%" stop-color="#6366F1" />
                </linearGradient>
            </defs>

            {/* <!-- Left arm --> */}
            <path
                d="M12 16H24L32 40L24 48L12 16Z"
                fill="url(#visualboard-gradient)"
            />

            {/* <!-- Right arm --> */}
            <path
                d="M40 16H52L40 48H28L40 16Z"
                fill="url(#visualboard-gradient)"
            />
        </svg>
    )
}