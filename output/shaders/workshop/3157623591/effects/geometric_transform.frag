// [COMBO] {"material":"Method","combo":"METHOD","type":"options","default":0,"options":{"Orbicular Surround":0,"Work In Progress...":1}}
// [COMBO] {"material":"Fixed Point","combo":"FPOINT","type":"options","default":1,"options":{"Center":0,"Side":1}}


uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}

uniform float u_osCurvature; // {"material":"Curvature","default":1,"range":[0,2]}
uniform float u_osStrength; // {"material":"Strength","default":0.5,"range":[-1,1]}
uniform float u_osRadialStrength; // {"material":"Radial Tensile Strength","default":0.5,"range":[0,1]}

varying vec2 v_TexCoord;

void main() {
	float d = abs(v_TexCoord.x - 0.5) * u_osCurvature;
#if METHOD == 0
	float offset = sqrt(0.25 - (d * d));
#if FPOINT == 0
	v_TexCoord.y += (offset - 0.5) * u_osStrength;
#endif
#if FPOINT == 1
	v_TexCoord.y += offset * u_osStrength;
#endif
	v_TexCoord.x = mix(v_TexCoord.x, sign(v_TexCoord.x - 0.5) * (0.5 - offset) + 0.5, u_osRadialStrength * abs(u_osStrength));
#endif
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy);
	gl_FragColor = albedo;
}
