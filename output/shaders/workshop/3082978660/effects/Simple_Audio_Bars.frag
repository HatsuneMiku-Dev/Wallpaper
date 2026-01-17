
// [COMBO] {"material":"Transparency","combo":"TRANSPARENCY","type":"options","default":1,"options":{"Preserve original":0,"Replace original":1,"Add to original":2,"Subtract from original":3,"Intersect original":4,"Fully opaque":5}}
// [COMBO] {"material":"Frequency Resolution","combo":"RESOLUTION","type":"options","default":32,"options":{"16":16,"32":32,"64":64}}
// [COMBO] {"material":"Audio Buffer Source","combo":"SOURCE","type":"options","default":1,"options":{"Default":1,"Render Target":0}}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Hollow","combo":"HOLLOW","type":"options","default":0,"require":{"BAR_STYLE":1}}
// [COMBO] {"material":"Hidden Bottom","combo":"HID_BTM","type":"options","default":0}
// [COMBO] {"material":"Anti-aliasing","combo":"ANTIALIAS","type":"options","default":1}
// [COMBO] {"material":"Hide Below Lower Bounds","combo":"CLIP_LOW","type":"options","default":0}
// [COMBO] {"material":"Hide Above Upper Bounds","combo":"CLIP_HIGH","type":"options","default":0}
// [COMBO] {"material":"Volume Remapping","combo":"V_REMAPPING","type":"options","default":0,"options":{"Linear (no remapping)":0,"Log10":1,"Log10 (inversed)":2,"Log5":9,"Log5 (inversed)":10,"Log2":11,"Log2 (inversed)":12,"Square":3,"Square (inversed)":4,"Cubic":5,"Cubic (inversed)":6,"Circle":7,"Circle (inversed)":8}}
// [COMBO] {"material":"Segment","combo":"SEGMENT","type":"options","default":0}


#define SMOOTH_CURVE // For compatability with old wallpapers that get ported to Android

#include "common.h"
#include "common_blending.h"

#define DEG2RAD 0.01745329251994329576923690768489 // 2 * PI / 360
#define DEG2PCT 0.0027777777777777777777777777777 // 1 / 360
#define LG2 0.30102999566398119521373889472449
#define LOG5_2 0.43067655807339306
#define M_D_PI_2 1 / M_PI_2

varying vec2 v_TexCoord;
varying vec2 p_TexCoord;
#if BAR_STYLE == 1
varying float i_DCorrectingFactor;
#endif

uniform float u_TsOfHiding; // {"material":"Threshold of Hiding","default":0.1,"range":[0, 1],"group":"Hidden Bottom"}
uniform float u_DynamicHiding; // {"material":"Dynamic Hiding Threshold","default":0.0,"range":[-1, 1],"group":"Hidden Bottom"}
uniform float u_BarCount; // {"material":"Bar Count","default":32,"range":[1, 200],"group":"General"}
uniform vec2 u_CircleAngles; // {"default":"0.0, 360.0","group":"General","linked":true,"material":"Circle Start/End Angles","range":[0,360]}
uniform float u_VolumeFactor; // {"material":"Volume Factor","default":1,"range":[0,1.5],"group":"General"}
uniform vec3 u_BarColor; // {"default":"1 1 1","group":"ui_editor_properties_color","material":"Bar Color","type":"color"}
uniform float u_BarOpacity; // {"default":"1","group":"ui_editor_properties_color","material":"ui_editor_properties_opacity"}
uniform float u_BarSpacing; // {"default":"0.1","group":"General","material":"Bar Spacing"}
uniform vec2 u_AASmoothness; // {"default":"0.02, 0.02","group":"Anti-aliasing","linked":true,"material":"Anti-alias blurring","range":[0.01,0.1]}
uniform vec2 u_rAASmoothness; // {"default":"0.05, 0.00","group":"Anti-aliasing","linked":true,"material":"Anti-alias blurring ","range":[0,0.2]}
uniform float u_Radius; // {"material":"Radius","default":1,"range":[0.1,1],"group":"Rounded corner"}
uniform float u_RadiusForH; // {"material":"Radius (Too small will become solid)","default":1,"range":[0.1,1],"group":"Rounded corner"}
uniform float u_minHeight; // {"material":"Minimum Height (Will be multiplied by the bar width)","default":0,"range":[0,1],"group":"Rounded corner"}
uniform float u_minHeightForC; // {"material":"Minimum Height (Will be multiplied by the bar width) ","default":1,"range":[0,1],"group":"Rounded corner"}
uniform float u_BorderWidth; // {"material":"Border Width","default":0.2,"range":[0,2],"group":"Hollow"}
uniform float u_SegmentSpacing; // {"material":"Segment Spacing","default":0.2,"range":[0,1],"group":"Segment"}
uniform float u_SegmentCount; // {"material":"Segment Count","default":32,"range":[0,100],"int":true,"group":"Segment"}
uniform float u_SegmentThreshold; // {"material":"Segment Threshold","default":0.5,"range":[0,1],"group":"Segment"}
uniform vec2 u_BarBounds; // {"default":"0.0, 1.0","group":"General","linked":true,"material":"Lower/Upper Bar Bounds","range":[0,1]}


uniform sampler2D g_Texture0; // {"material":"previous","label":"Prev","hidden":true}
uniform sampler2D g_Texture1; // {"material":"externalAudioBuffer","label":"Audio Data Render Target","combo":"HasExternalAudioBuffer","require":{"SOURCE":0}}
uniform vec4 g_Texture0Resolution;

#if !HasExternalAudioBuffer || SOURCE
#if RESOLUTION == 16
uniform float g_AudioSpectrum16Left[16];
uniform float g_AudioSpectrum16Right[16];
#endif

#if RESOLUTION == 32
uniform float g_AudioSpectrum32Left[32];
uniform float g_AudioSpectrum32Right[32];
#endif

#if RESOLUTION == 64
uniform float g_AudioSpectrum64Left[64];
uniform float g_AudioSpectrum64Right[64];
#endif
#endif

// Style


// Shape & Position
#define BOTTOM 0
#define TOP 1
#define LEFT 2
#define RIGHT 3
#define CIRCLE_INNER 4
#define CIRCLE_OUTER 5
#define CENTER_H 6
#define CENTER_V 7
#define STEREO_H 8
#define STEREO_V 9


// Transparency
#define PRESERVE 0
#define REPLACE 1
#define ADD 2
#define SUBTRACT 3
#define INTERSECT 4
#define REMOVE 5

// Volume Remapping
#define LINEAR 0
#define LOG10 1
#define LOG10_INV 2
#define SQUARE 3
#define SQUARE_INV 4
#define CUBIC 5
#define CUBIC_INV 6
#define CIRCLE 7
#define CIRCLE_INV 8
#define LOG5 9
#define LOG5_INV 10
#define LOG2 11
#define LOG2_INV 12

// Same as GLSL's modulo function. Return value's sign is equivalent to the y value's sign.
float mod2(float x, float y) { return x - y * floor(x/y); }

#if BAR_STYLE == 1
float roundedBoxSDF(vec2 CurPosition, vec3 Size, float DCorrectingFactor) {
	Size *= 0.5;
	Size.x *= DCorrectingFactor;
	CurPosition.y -= Size.y + Size.z;
	Size.y -= Size.z;
	float r = u_Radius * min(Size.x, Size.y);
	CurPosition.x *= DCorrectingFactor;
	return length(max(abs(CurPosition) - Size.xy + r, 0.0)) - r;
}

float roundedHollowBoxSDF(vec2 CurPosition, vec3 Size, float DCorrectingFactor) {
	Size *= 0.5;
	Size.x *= DCorrectingFactor;
	CurPosition.y -= Size.y + Size.z;
	Size.y -= Size.z;
	float BorderWidth = u_BorderWidth * 0.01;
	float r = u_RadiusForH * min(Size.x, Size.y) - BorderWidth;
	vec2 delta = abs(CurPosition) - (Size.xy - BorderWidth) + r;
	CurPosition.x *= DCorrectingFactor;
	return length(max(delta, 0.0)) - r;
}
#endif

float remapVolume(float volume) {
#if V_REMAPPING == LINEAR
	return volume;
#endif
#if V_REMAPPING == LOG10
	return log2(9 * volume + 1) * LG2;
#endif
#if V_REMAPPING == LOG10_INV
	return 1 - log2(-9 * volume + 10) * LG2;
#endif
#if V_REMAPPING == LOG5
	return log2(4 * volume + 1) * LOG5_2;
#endif
#if V_REMAPPING == LOG5_INV
	return 1 - log2(-4 * volume + 5) * LOG5_2;
#endif
#if V_REMAPPING == LOG2
	return log2(volume + 1);
#endif
#if V_REMAPPING == LOG2_INV
	return 1 - log2(-1 * volume + 2);
#endif
#if V_REMAPPING == SQUARE
	return volume * volume;
#endif
#if V_REMAPPING == SQUARE_INV
	volume = 1 - volume;
	return 1 - volume * volume;
#endif
#if V_REMAPPING == CUBIC
	return volume * volume * volume;
#endif
#if V_REMAPPING == CUBIC_INV
	volume = 1 - volume;
	return 1 - volume * volume * volume;
#endif
#if V_REMAPPING == CIRCLE
	return min(1, 1 - sqrt(1 - pow(volume, 2)));
#endif
#if V_REMAPPING == CIRCLE_INV
	return min(1, sqrt(1 - pow(volume - 1, 2)));
#endif
}


void main() {
	
	// Define the audio sample arrays
#if !HasExternalAudioBuffer || SOURCE
#if RESOLUTION == 16
#define u_AudioSpectrumLeft g_AudioSpectrum16Left
#define u_AudioSpectrumRight g_AudioSpectrum16Right
#endif
#if RESOLUTION == 32
#define u_AudioSpectrumLeft g_AudioSpectrum32Left
#define u_AudioSpectrumRight g_AudioSpectrum32Right
#endif
#if RESOLUTION == 64
#define u_AudioSpectrumLeft g_AudioSpectrum64Left
#define u_AudioSpectrumRight g_AudioSpectrum64Right
#endif
#endif

#if SHAPE == BOTTOM
	// vec2 v_TexCoord = v_TexCoord;
#endif
#if SHAPE == TOP
	v_TexCoord.y = 1.0 - v_TexCoord.y;
#endif
#if SHAPE == LEFT
	v_TexCoord = v_TexCoord.yx;
	v_TexCoord.y = 1.0 - v_TexCoord.y;
#endif
#if SHAPE == RIGHT
	v_TexCoord = v_TexCoord.yx;
#endif
#if SHAPE == CENTER_H
	v_TexCoord = v_TexCoord.yx;
	v_TexCoord.y = frac(0.5 - v_TexCoord.y) + floor(v_TexCoord.y);
#endif
#if SHAPE == CENTER_V
	v_TexCoord.y = frac(0.5 - v_TexCoord.y) + floor(v_TexCoord.y);
#endif
#if SHAPE == STEREO_H
	v_TexCoord = v_TexCoord.yx;
#endif
#if SHAPE == STEREO_V
	// v_TexCoord = v_TexCoord.xy;
#endif
#if SHAPE == CIRCLE_INNER || SHAPE == CIRCLE_OUTER
	vec2 circleCoord = (v_TexCoord - 0.5) * 2.0;
	vec2 angleRange = u_CircleAngles * DEG2PCT;
	v_TexCoord.x = (atan2(circleCoord.y, circleCoord.x) + M_PI) * M_D_PI_2;
	// Shift to start angle
	v_TexCoord.x = mod2(v_TexCoord.x - min(angleRange.x, angleRange.y), 1.0);
	// Scale to area between start and end angles
	// y = 1 / (abs((x - 1) % 4 - 2) - 1)
	v_TexCoord.x = v_TexCoord.x / (abs(mod2(angleRange.y - angleRange.x - 1.0, 4.0) - 2.0) - 1.0);
	// Keep coordinates positive. Adds 1.0 if the end is before the start.
	v_TexCoord.x += float((angleRange.y - angleRange.x) < 0.0);
	v_TexCoord.y = sqrt(circleCoord.x * circleCoord.x + circleCoord.y * circleCoord.y);
#if SHAPE == CIRCLE_INNER
	v_TexCoord.y = 1.0 - v_TexCoord.y;
#endif
#endif

	// Get the frequency for this pixel, ie where we will sample from in the audio spectrum array. 0 == lowest frequency, RESOLUTION == highest frequency.
#if BAR_STYLE == 2
	float frequency = v_TexCoord.x * float(RESOLUTION);
#else
	// BarDist == How far this pixel is from the center of the bar that it belongs to. 0 = right in the middle, 1 = right on the edge.
	float barDist = abs(frac(v_TexCoord.x * u_BarCount) * 2.0 - 1.0);
	float frequency = floor(v_TexCoord.x * u_BarCount) / u_BarCount * float(RESOLUTION);
#endif
	float barFreq1 = mod2(frequency, float(RESOLUTION));
	float barFreq2 = mod2((barFreq1 + 1.0), float(RESOLUTION));

	// Rounded bar (preparation)
#if BAR_STYLE == 1
	float rW = (1.0 - u_BarSpacing) / u_BarCount;

#if SEGMENT == 0 && (SHAPE == CENTER_H || SHAPE == CENTER_V)
	float minBarHeight = u_minHeightForC * rW;
#else
	float minBarHeight = u_minHeight * rW;
#endif

#if HOLLOW
	float BorderWidth = u_BorderWidth * 0.01;
#endif

#if SHAPE == LEFT || SHAPE == RIGHT || SHAPE == CENTER_H || SHAPE == STEREO_H
	minBarHeight *= i_DCorrectingFactor;
#if ANTIALIAS
	float rAntiAliasFactor = 15 / min(g_Texture0Resolution.x, g_Texture0Resolution.y); //* i_DCorrectingFactor;
#endif
#else
	minBarHeight *= i_DCorrectingFactor;
#if ANTIALIAS
	float rAntiAliasFactor = 15 / min(g_Texture0Resolution.x, g_Texture0Resolution.y);
#endif
#endif

#if ANTIALIAS
	float rAASmoothnessX = -u_rAASmoothness.x * rAntiAliasFactor;
#if SEGMENT
	float rAASmoothnessY = 0;
	rAASmoothnessX -= u_rAASmoothness.y * rAntiAliasFactor;
#else
	float rAASmoothnessY = u_rAASmoothness.y * rAntiAliasFactor;
#endif
#endif

#endif

	float u_BarBoundsX = u_BarBounds.x;
	float u_BarBoundsY = u_BarBounds.y;

	// Half
#if SHAPE == CENTER_H || SHAPE == CENTER_V || SHAPE == STEREO_H || SHAPE == STEREO_V
	//u_BarBoundsX *= 0.5;
	//u_BarBoundsY *= 0.5;
#endif

	// Segment threshold
#if SEGMENT
	float segmentH = 1 / u_SegmentCount;
	float segemntOffset = segmentH * u_SegmentThreshold;
	float tsOfHiding = u_TsOfHiding - mod(u_TsOfHiding, segmentH);
	float DynamicHiding = u_DynamicHiding - mod(u_DynamicHiding, segmentH);
#if BAR_STYLE == 1
	minBarHeight -= mod(minBarHeight, segmentH);
#endif
#if CLIP_LOW == 1
	u_BarBoundsX -= mod(u_BarBoundsX, segmentH);
#endif
#if CLIP_HIGH == 1
	u_BarBoundsY -= mod(u_BarBoundsY, segmentH);
#endif
#else
	float tsOfHiding = u_TsOfHiding;
	float DynamicHiding = u_DynamicHiding;
#endif

#if !SOURCE && HasExternalAudioBuffer
	vec4 externalAudioData1 = texSample2DLod(g_Texture1, vec2((int(barFreq1) + 0.5) / RESOLUTION, 0.5), 0);
	vec4 externalAudioData2 = texSample2DLod(g_Texture1, vec2((int(barFreq2) + 0.5) / RESOLUTION, 0.5), 0);
#endif

	// Get the height of the bar
// STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ****** STEREO ******
#if SHAPE == STEREO_H || SHAPE == STEREO_V || SHAPE == CENTER_H || SHAPE == CENTER_V

	
#if !HasExternalAudioBuffer || SOURCE
	float barVolume1L = u_AudioSpectrumLeft[int(barFreq1)];
	float barVolume2L = u_AudioSpectrumLeft[int(barFreq2)];
	float barVolume1R = u_AudioSpectrumRight[int(barFreq1)];
	float barVolume2R = u_AudioSpectrumRight[int(barFreq2)];
#else
	float barVolume1L = (externalAudioData1.x + externalAudioData1.z) * 0.5;
	float barVolume2L = (externalAudioData2.x + externalAudioData2.z) * 0.5;
	float barVolume1R = (externalAudioData1.y + externalAudioData1.w) * 0.5;
	float barVolume2R = (externalAudioData2.y + externalAudioData2.w) * 0.5;
#endif
	float barVolumeLeft = remapVolume(mix(barVolume1L, barVolume2L, smoothstep(0.0, 1.0, frac(frequency)))) * u_VolumeFactor;
	float barVolumeRight = remapVolume(mix(barVolume1R, barVolume2R, smoothstep(0.0, 1.0, frac(frequency)))) * u_VolumeFactor;

	// bar = 1 if this pixel is inside a bar, 0 if outside
#if BAR_STYLE == 1
	float barHeightLeft = 0.5 * mix(max(u_BarBoundsX, minBarHeight) * 2, u_BarBoundsY, barVolumeLeft);
	float barHeightRight = 0.5 * mix(max(u_BarBoundsX, minBarHeight) * 2, u_BarBoundsY, barVolumeRight);
#else
	float barHeightLeft = 0.5 * mix(u_BarBoundsX, u_BarBoundsY, barVolumeLeft);
	float barHeightRight = 0.5 * mix(u_BarBoundsX, u_BarBoundsY, barVolumeRight);
#endif

	// Segment threshold
#if SEGMENT
	barHeightLeft = barHeightLeft - mod(barHeightLeft + segemntOffset, segmentH) + segemntOffset;
	barHeightRight = barHeightRight - mod(barHeightRight + segemntOffset, segmentH) + segemntOffset;
#endif

#if BAR_STYLE == 1
	float rBoxUpperBoundL = barHeightLeft;
	float rBoxUpperBoundR = barHeightRight;
#if HID_BTM
	float rBoxLowerBoundL = max(0, barHeightLeft - tsOfHiding - DynamicHiding * barHeightLeft);
	float rBoxLowerBoundR = max(0, barHeightRight - tsOfHiding - DynamicHiding * barHeightRight);
#else
	float rBoxLowerBoundL = 0;
	float rBoxLowerBoundR = 0;
#endif
#endif

#if BAR_STYLE != 1
#if ANTIALIAS == 1
	float verticalSmoothingLeft = u_AASmoothness.y * 0.05, verticalSmoothingRight = verticalSmoothingLeft;
	verticalSmoothingLeft *= saturate(mix(0.0, 1.0, barVolumeLeft * 100.0)); // Don't blur when near 0 volume
	verticalSmoothingRight *= saturate(mix(0.0, 1.0, barVolumeRight * 100.0));
	float barLeft = smoothstep(v_TexCoord.y - verticalSmoothingLeft, v_TexCoord.y + verticalSmoothingLeft, barHeightLeft);
	float barRight = smoothstep(1.0 - v_TexCoord.y - verticalSmoothingRight, 1.0 - v_TexCoord.y + verticalSmoothingRight, barHeightRight);
#if HID_BTM
	barLeft *= smoothstep(v_TexCoord.y + verticalSmoothingLeft, v_TexCoord.y - verticalSmoothingLeft, barHeightLeft - tsOfHiding - DynamicHiding * barHeightLeft);
	barRight *= smoothstep(1.0 - v_TexCoord.y + verticalSmoothingRight, 1.0 - v_TexCoord.y - verticalSmoothingRight, barHeightRight - tsOfHiding - DynamicHiding * barHeightRight);
#endif
#else
	float barLeft = float(step(v_TexCoord.y, barHeightLeft));
	float barRight = float(step(1.0 - v_TexCoord.y, barHeightRight));
#if HID_BTM
	barLeft *= step(barHeightLeft - tsOfHiding - DynamicHiding * barHeightLeft, v_TexCoord.y);
	barRight *= step(barHeightRight - tsOfHiding - DynamicHiding * barHeightRight, 1.0 - v_TexCoord.y);
#endif
#endif
#endif

#if SHAPE == CENTER_H || SHAPE == CENTER_V
#if BAR_STYLE == 1
	// Clip the L/R channels for center, so they don't wrap around.
	float barLeft = float(v_TexCoord.y < 0.49);
	float barRight = float(v_TexCoord.y > 0.51);
#else
	// Clip the L/R channels for center, so they don't wrap around.
	barLeft *= float(v_TexCoord.y < 0.49);
	barRight *= float(v_TexCoord.y > 0.51);
#endif
#else
#if BAR_STYLE == 1
	// Clip the L/R channels for center, so they don't wrap around.
	float barLeft = float(v_TexCoord.y < 0.49);
	float barRight = float(v_TexCoord.y > 0.51);
#endif
#endif

	// Bounds Clipping (Stereo)
#if CLIP_HIGH == 1

#if BAR_STYLE == 1
	rBoxUpperBoundL = min(rBoxUpperBoundL, u_BarBoundsY * 0.5);
	rBoxUpperBoundR = min(rBoxUpperBoundR, u_BarBoundsY * 0.5);
#else
#if ANTIALIAS == 1
	barLeft *= smoothstep(v_TexCoord.y - verticalSmoothingLeft, 1.0 - v_TexCoord.y + verticalSmoothingLeft, u_BarBoundsY);
	barRight *= smoothstep(1.0 - v_TexCoord.y - verticalSmoothingRight, 1.0 - v_TexCoord.y + verticalSmoothingRight, u_BarBoundsY);
#else
	barLeft *= float(step(v_TexCoord.y, u_BarBoundsY));
	barRight *= float(step(1.0 - v_TexCoord.y, u_BarBoundsY));
#endif
#endif

#endif

#if CLIP_LOW == 1

#if BAR_STYLE == 1
	//float modedBarBoundsX = u_BarBoundsX * 0.5 + mod(u_BarBoundsX * 0.5, segmentH);
	rBoxLowerBoundL = max(u_BarBoundsX, rBoxLowerBoundL);
	rBoxLowerBoundR = max(u_BarBoundsX, rBoxLowerBoundR);
#else
#if ANTIALIAS == 1
	barLeft *= 1.0 - smoothstep(v_TexCoord.y - verticalSmoothingLeft, v_TexCoord.y + verticalSmoothingLeft, 0.5 * u_BarBoundsX);
	barRight *= 1.0 - smoothstep(1.0 - v_TexCoord.y - verticalSmoothingRight, 1.0 - v_TexCoord.y + verticalSmoothingRight, 0.5 * u_BarBoundsX);
#else
	barLeft *= 1.0 - float(step(v_TexCoord.y, 0.5 * u_BarBoundsX));
	barRight *= 1.0 - float(step(1.0 - v_TexCoord.y, 0.5 * u_BarBoundsX));
#endif
#endif

#endif


#if BAR_STYLE == 1
	rBoxLowerBoundL = max(0, min(rBoxLowerBoundL, rBoxUpperBoundL - minBarHeight));
	rBoxLowerBoundR = max(0, min(rBoxLowerBoundR, rBoxLowerBoundR - minBarHeight));

#if SEGMENT
	rBoxUpperBoundL = segmentH * (1 - u_SegmentSpacing) * step(rBoxLowerBoundL, v_TexCoord.y);
	rBoxUpperBoundR = segmentH * (1 - u_SegmentSpacing) * step(rBoxLowerBoundR, 1.0 - v_TexCoord.y);
	rBoxLowerBoundL = 0;
	rBoxLowerBoundR = 0;
	vec2 rCenterL = vec2(barDist / u_BarCount * 0.5, mod(1.0 - v_TexCoord.y, segmentH));
	vec2 rCenterR = rCenterL;
	rCenterL.y -= (segmentH - rBoxUpperBoundL) * 0.25;
	rCenterR.y -= (segmentH - rBoxUpperBoundR) * 0.25;
#else
	vec2 rCenterL = vec2(barDist / u_BarCount * 0.5, v_TexCoord.y);
	vec2 rCenterR = vec2(barDist / u_BarCount * 0.5, 1.0 - v_TexCoord.y);
#endif

	vec3 barSizeL = vec3(rW, rBoxUpperBoundL, rBoxLowerBoundL);
	vec3 barSizeR = vec3(rW, rBoxUpperBoundR, rBoxLowerBoundR);

#if SEGMENT == 0 && (SHAPE == CENTER_H || SHAPE == CENTER_V)
#if SHAPE == CENTER_H
	float rBarOffset = min(rW, max(barSizeL.y, barSizeR.y)) * 0.5;
#else
	float rBarOffset = min(rW, max(barSizeL.y, barSizeR.y)) * 0.5 * i_DCorrectingFactor;
#endif
	rCenterL.y += rBarOffset;
	rCenterR.y += rBarOffset;
#endif

#if HOLLOW == 1
	float dL = roundedHollowBoxSDF(rCenterL, barSizeL, i_DCorrectingFactor);
	float dR = roundedHollowBoxSDF(rCenterR, barSizeR, i_DCorrectingFactor);
#else
	float dL = roundedBoxSDF(rCenterL, barSizeL, i_DCorrectingFactor);
	float dR = roundedBoxSDF(rCenterR, barSizeR, i_DCorrectingFactor);
#endif

#if SEGMENT
	dL *= step(v_TexCoord.y, barHeightLeft);
	dR *= step(1.0 - v_TexCoord.y, barHeightRight);
#endif

#if HOLLOW == 1
#if ANTIALIAS == 1
	float bar = 1.0 - min(smoothstep(rAASmoothnessX, rAASmoothnessY, abs(dL) - BorderWidth), smoothstep(rAASmoothnessX, rAASmoothnessY, abs(dR) - BorderWidth));
#else
	float bar = 1.0 - min(step(0, abs(dL) - BorderWidth), step(0, abs(dR) - BorderWidth));
#endif
#else
#if ANTIALIAS == 1
	float bar = 1.0 - min(smoothstep(rAASmoothnessX, rAASmoothnessY, dL), smoothstep(rAASmoothnessX, rAASmoothnessY, dR));
#else
	float bar = 1.0 - min(step(0, dL), step(0, dR));
#endif
#endif

#else

	float bar = max(barLeft, barRight);

#endif

// NON-STEREO *********** NON-STEREO *********** NON-STEREO *********** NON-STEREO *********** NON-STEREO *********** NON-STEREO ***********
#else
#if !HasExternalAudioBuffer || SOURCE
	float barVolume1 = (u_AudioSpectrumLeft[int(barFreq1)] + u_AudioSpectrumRight[int(barFreq1)]) * 0.5;
	float barVolume2 = (u_AudioSpectrumLeft[int(barFreq2)] + u_AudioSpectrumRight[int(barFreq2)]) * 0.5;
#else
	float barVolume1 = (externalAudioData1.x + externalAudioData1.y + externalAudioData1.z + externalAudioData1.w) * 0.25;
	float barVolume2 = (externalAudioData2.x + externalAudioData2.y + externalAudioData2.z + externalAudioData2.w) * 0.25;
#endif
	float barVolume = remapVolume(mix(barVolume1, barVolume2, smoothstep(0.0, 1.0, frac(frequency)))) * u_VolumeFactor;

	// How tall the bar is in the current pixel's column
#if BAR_STYLE == 1
	float barHeight = mix(max(u_BarBoundsX, minBarHeight), u_BarBoundsY, barVolume);
#else
	float barHeight = mix(u_BarBoundsX, u_BarBoundsY, barVolume);
#endif

	// Segment threshold
#if SEGMENT
	barHeight -= mod(barHeight + segemntOffset, segmentH) + segemntOffset;
#endif

#if HID_BTM
	tsOfHiding += DynamicHiding * barHeight;
#endif

#if BAR_STYLE == 1
	float rBoxUpperBound = barHeight;
#if HID_BTM
	float rBoxLowerBound = max(0, barHeight - tsOfHiding);
#else
	float rBoxLowerBound = 0;
#endif
#endif

	// bar = 1 if this pixel is inside a bar, 0 if outside
#if BAR_STYLE != 1
#if ANTIALIAS == 1
	float verticalSmoothing = u_AASmoothness.y * 0.05;
	verticalSmoothing *= saturate(mix(0.0, 1.0, barVolume * 100.0)); // Don't blur when near 0 volume
	float bar = smoothstep(1.0 - v_TexCoord.y - verticalSmoothing, 1.0 - v_TexCoord.y + verticalSmoothing, barHeight);
#if HID_BTM
	bar *= smoothstep(1.0 - v_TexCoord.y + verticalSmoothing, 1.0 - v_TexCoord.y - verticalSmoothing, barHeight - tsOfHiding);
#endif
#else
	float bar = float(step(1.0 - v_TexCoord.y, barHeight));
#if HID_BTM
	bar *= step(barHeight - tsOfHiding, 1.0 - v_TexCoord.y);
#endif
#endif
#endif


	// Bounds Clipping (Non-stereo)
#if CLIP_HIGH == 1

#if BAR_STYLE == 1
	rBoxUpperBound = min(rBoxUpperBound, u_BarBoundsY);
#else
#if ANTIALIAS == 1
	bar *= smoothstep(1.0 - v_TexCoord.y - verticalSmoothing, 1.0 - v_TexCoord.y + verticalSmoothing, u_BarBoundsY);
#else
	bar *= float(step(1.0 - v_TexCoord.y, u_BarBoundsY));
#endif
#endif

#endif

#if CLIP_LOW == 1

#if BAR_STYLE == 1
	rBoxLowerBound = max(u_BarBoundsX, rBoxLowerBound);
#else
#if ANTIALIAS == 1
	bar *= 1.0 - smoothstep(1.0 - v_TexCoord.y - verticalSmoothing, 1.0 - v_TexCoord.y + verticalSmoothing, u_BarBoundsX);
#else
	bar *= 1.0 - step(1.0 - v_TexCoord.y, u_BarBoundsX);
#endif
#endif

#endif

	// Rounded bar
#if BAR_STYLE == 1
	rBoxLowerBound = max(0, min(rBoxLowerBound, rBoxUpperBound - minBarHeight));

#if SEGMENT
	rBoxUpperBound = segmentH * (1 - u_SegmentSpacing) * step(rBoxLowerBound, 1.0 - v_TexCoord.y);
	rBoxLowerBound = 0;
	vec2 rCenter = vec2(barDist / u_BarCount * 0.5, mod(1.0 - v_TexCoord.y, segmentH) - (segmentH - rBoxUpperBound) * 0.5);
#else
	vec2 rCenter = vec2(barDist / u_BarCount * 0.5, 1.0 - v_TexCoord.y);
#endif

	vec3 barSize = vec3(rW, rBoxUpperBound, rBoxLowerBound);

#if SEGMENT
	barSize *= step(1.0 - v_TexCoord.y, barHeight);
#endif

#if HOLLOW == 1
	float d = roundedHollowBoxSDF(rCenter, barSize, i_DCorrectingFactor);
#else
	float d = roundedBoxSDF(rCenter, barSize, i_DCorrectingFactor);
#endif


#if HOLLOW == 1
#if ANTIALIAS == 1
	float bar = 1.0 - smoothstep(rAASmoothnessX, rAASmoothnessY, abs(d) - BorderWidth);
#else
	float bar = 1.0 - step(0, abs(d) - BorderWidth);
#endif
#else
#if ANTIALIAS == 1
	float bar = 1.0 - smoothstep(rAASmoothnessX, rAASmoothnessY, d);
#else
	float bar = 1.0 - step(0, d);
#endif
#endif

#endif

#endif // End of stereo vs non-stereo



	// Semi-circle clipping
#if SHAPE == CIRCLE_INNER || SHAPE == CIRCLE_OUTER
// #if ANTIALIAS == 1
// 	bar *= smoothstep(0.0, u_AASmoothness * 0.1, v_TexCoord.x) * smoothstep(1.0, 1.0 - u_AASmoothness, v_TexCoord.x * float(sign(angleRange.y - angleRange.x)));
// #else
	bar *= float((v_TexCoord.x > 0.0) && (v_TexCoord.x * float(sign(angleRange.y - angleRange.x)) < 1.0));
// #endif
#endif



	// Bar spacing
#if BAR_STYLE == 0
#if ANTIALIAS == 1
	bar *= max(1.0 - float(step(0.01, u_BarSpacing)), smoothstep(barDist - u_AASmoothness.x, barDist + u_AASmoothness.x, (1.0 - u_BarSpacing)));
#else
	bar *= float(step(barDist, 1.0 - u_BarSpacing));
#endif
#endif

	// Generic segment
#if BAR_STYLE != 1
#if SEGMENT
	float barSegment = abs(frac((1 - v_TexCoord.y) * u_SegmentCount) * 2.0 - 1.0);
#if ANTIALIAS
	bar *= max(1.0 - float(step(0.01, u_SegmentSpacing)), smoothstep(barSegment - u_AASmoothness.y, barSegment + u_AASmoothness.y, 1.0 - u_SegmentSpacing));
#else
	bar *= step(barSegment, 1 - u_SegmentSpacing);
#endif
#endif
#endif

	vec3 finalColor = u_BarColor;
	
	// Get the existing pixel color
	vec4 scene = texSample2D(g_Texture0, p_TexCoord);

	// Apply blend mode
	finalColor = ApplyBlending(BLENDMODE, mix(finalColor.rgb, scene.rgb, scene.a), finalColor.rgb, bar * u_BarOpacity);



#if TRANSPARENCY == PRESERVE
	float alpha = scene.a;
#endif
#if TRANSPARENCY == REPLACE
	float alpha = bar * u_BarOpacity;
#endif
#if TRANSPARENCY == ADD
	float alpha = max(scene.a, bar * u_BarOpacity);
#endif
#if TRANSPARENCY == SUBTRACT
	float alpha = max(0.0, scene.a - bar * u_BarOpacity);
#endif
#if TRANSPARENCY == INTERSECT
	float alpha = scene.a * bar * u_BarOpacity;
#endif
#if TRANSPARENCY == REMOVE
	float alpha = u_BarOpacity;
#endif



	gl_FragColor = vec4(finalColor, alpha);
	//gl_FragColor = vec4(CAST3(v_TexCoord.x), alpha);
}