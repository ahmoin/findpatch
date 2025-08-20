"use client";

import * as React from "react";

interface ColorPickerProps {
	color: string;
	onColorChange: (color: string) => void;
	size?: "sm" | "md" | "lg";
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;

	let r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	return [
		Math.round((r + m) * 255),
		Math.round((g + m) * 255),
		Math.round((b + m) * 255),
	];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const diff = max - min;

	let h = 0;
	if (diff !== 0) {
		if (max === r) {
			h = ((g - b) / diff) % 6;
		} else if (max === g) {
			h = (b - r) / diff + 2;
		} else {
			h = (r - g) / diff + 4;
		}
	}
	h = Math.round(h * 60);
	if (h < 0) h += 360;

	const s = max === 0 ? 0 : diff / max;
	const v = max;

	return [h, s, v];
}

function hexToRgb(hex: string): [number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? [
				parseInt(result[1], 16),
				parseInt(result[2], 16),
				parseInt(result[3], 16),
			]
		: [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
	return (
		"#" +
		[r, g, b]
			.map((x) => {
				const hex = x.toString(16);
				return hex.length === 1 ? `0${hex}` : hex;
			})
			.join("")
	);
}

export function ColorPicker({
	color,
	onColorChange,
	size = "md",
}: ColorPickerProps) {
	const [rgb] = React.useState(() => hexToRgb(color));
	const [hsv, setHsv] = React.useState(() => rgbToHsv(rgb[0], rgb[1], rgb[2]));
	const [isDraggingSV, setIsDraggingSV] = React.useState(false);
	const [isDraggingHue, setIsDraggingHue] = React.useState(false);
	const svRef = React.useRef<HTMLButtonElement>(null);
	const hueRef = React.useRef<HTMLButtonElement>(null);

	// Update HSV when color prop changes
	React.useEffect(() => {
		const newRgb = hexToRgb(color);
		const newHsv = rgbToHsv(newRgb[0], newRgb[1], newRgb[2]);
		setHsv(newHsv);
	}, [color]);

	const updateColor = React.useCallback(
		(newHsv: [number, number, number]) => {
			const [r, g, b] = hsvToRgb(newHsv[0], newHsv[1], newHsv[2]);
			const hex = rgbToHex(r, g, b);
			onColorChange(hex);
			setHsv(newHsv);
		},
		[onColorChange],
	);

	const handleSVPointerDown = (clientX: number, clientY: number) => {
		setIsDraggingSV(true);
		handleSVPointerMove(clientX, clientY);
	};

	const handleSVPointerMove = (clientX: number, clientY: number) => {
		if (!svRef.current) return;

		const rect = svRef.current.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));

		updateColor([hsv[0], x, y]);
	};

	const handleHuePointerDown = (clientX: number, clientY: number) => {
		setIsDraggingHue(true);
		handleHuePointerMove(clientX, clientY);
	};

	const handleHuePointerMove = (_clientX: number, clientY: number) => {
		if (!hueRef.current) return;

		const rect = hueRef.current.getBoundingClientRect();
		const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
		const hue = y * 360;

		updateColor([hue, hsv[1], hsv[2]]);
	};

	const handleSVMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		handleSVPointerDown(e.clientX, e.clientY);
	};

	const handleSVTouchStart = (e: React.TouchEvent) => {
		e.preventDefault();
		const touch = e.touches[0];
		handleSVPointerDown(touch.clientX, touch.clientY);
	};

	const handleHueMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		handleHuePointerDown(e.clientX, e.clientY);
	};

	const handleHueTouchStart = (e: React.TouchEvent) => {
		e.preventDefault();
		const touch = e.touches[0];
		handleHuePointerDown(touch.clientX, touch.clientY);
	};

	//  biome-ignore lint/correctness/useExhaustiveDependencies: handle color change dependencies change on every re-render and should not be used as hook dependencies
	React.useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDraggingSV) {
				handleSVPointerMove(e.clientX, e.clientY);
			} else if (isDraggingHue) {
				handleHuePointerMove(e.clientX, e.clientY);
			}
		};

		const handleTouchMove = (e: TouchEvent) => {
			e.preventDefault();
			const touch = e.touches[0];
			if (isDraggingSV) {
				handleSVPointerMove(touch.clientX, touch.clientY);
			} else if (isDraggingHue) {
				handleHuePointerMove(touch.clientX, touch.clientY);
			}
		};

		const handlePointerUp = () => {
			setIsDraggingSV(false);
			setIsDraggingHue(false);
		};

		if (isDraggingSV || isDraggingHue) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handlePointerUp);
			document.addEventListener("touchmove", handleTouchMove, {
				passive: false,
			});
			document.addEventListener("touchend", handlePointerUp);
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handlePointerUp);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handlePointerUp);
		};
	}, [isDraggingSV, isDraggingHue]);

	const sizes = {
		sm: { sv: "size-24", hue: "w-4 h-24" },
		md: { sv: "size-32", hue: "w-6 h-32" },
		lg: { sv: "size-48", hue: "w-6 h-48" },
	};

	const svStyle = {
		background: `linear-gradient(to bottom, transparent 0%, black 100%), linear-gradient(to right, white 0%, transparent 100%)`,
		backgroundColor: `hsl(${hsv[0]}, 100%, 50%)`,
		backgroundSize: "100% 100%",
		backgroundRepeat: "no-repeat",
		backgroundPosition: "0 0",
	};

	const hueBackground =
		"linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

	return (
		<div className="flex gap-3">
			<div className="relative">
				<button
					ref={svRef}
					type="button"
					className={`${sizes[size].sv} cursor-crosshair rounded relative overflow-hidden touch-none`}
					style={svStyle}
					onMouseDown={handleSVMouseDown}
					onTouchStart={handleSVTouchStart}
					aria-label="Select saturation and brightness"
				>
					<div
						className="absolute w-3 h-3 border-2 border-white rounded-full shadow-md pointer-events-none"
						style={{
							left: `${hsv[1] * 100}%`,
							top: `${(1 - hsv[2]) * 100}%`,
							transform: "translate(-50%, -50%)",
						}}
					/>
				</button>
			</div>
			<div className="relative">
				<button
					ref={hueRef}
					type="button"
					className={`${sizes[size].hue} cursor-crosshair border border-border rounded p-0 relative touch-none`}
					style={{ background: hueBackground }}
					onMouseDown={handleHueMouseDown}
					onTouchStart={handleHueTouchStart}
					aria-label="Select hue"
				>
					<div
						className="absolute w-full h-1 border border-white shadow-md pointer-events-none"
						style={{
							top: `${(hsv[0] / 360) * 100}%`,
							transform: "translateY(-50%)",
						}}
					/>
				</button>
			</div>
		</div>
	);
}
