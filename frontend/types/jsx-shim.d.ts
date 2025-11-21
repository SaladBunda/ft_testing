// Minimal JSX shim so the linter can parse JSX without full React types
declare namespace JSX {
	interface IntrinsicElements {
		[elemName: string]: any;
	}
}


