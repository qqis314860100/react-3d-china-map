import * as THREE from "three";

export interface RadarOption {
  position: any;
  radius: number;
  color: string;
  opacity: number;
  angle: number;
  speed: number;
}

// 雷达配置项 - 优化后的雷达效果
export const radarData: RadarOption[] = [
  {
    position: new THREE.Vector3(0, 0, -10), // 放在地图底部
    radius: 80, // 增大半径，更明显
    color: "#00D4FF", // 更亮的青色
    opacity: 0.6, // 提高透明度
    angle: Math.PI * 2, // 扫描区域大小的弧度指
    speed: 1.5, // 稍微减慢速度，更平滑
  },
  {
    position: new THREE.Vector3(0, 0, -10), // 放在地图底部
    radius: 60, // 内圈
    color: "#3EC5FB", // 亮蓝色
    opacity: 0.5,
    angle: Math.PI * 2,
    speed: 1.5,
  },
  {
    position: new THREE.Vector3(0, 0, -10), // 放在地图底部
    radius: 40, // 最内圈
    color: "#5BB1FF", // 浅蓝色
    opacity: 0.4,
    angle: Math.PI * 2,
    speed: 1.5,
  },
];

// 顶点着色器
const vertexShader = `
precision mediump float;
precision highp int;

varying vec2 vPosition;
void main () {
    // 把当前像素点的x和y专递给片元着色器，这里我们在xy轴所在平面上画图，不考虑z轴
    vPosition = vec2(position.x, position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
precision mediump float;
precision highp int;

// 接收从js中传入的uniform数据
uniform float uTime;
uniform float u_radius;
uniform float u_speed;
uniform float u_opacity;
uniform float u_width;
uniform vec3 u_color;

varying vec2 vPosition;
#define PI 3.14159265359

void main () {
    // 计算当前扫描旋转的弧度值总数
    float currentRadius = u_speed * uTime;

    // 计算当前像素点与原点连线和x轴构成的夹角的弧度值
    float angle = atan(vPosition.y, vPosition.x) + PI;

    // 计算当前像素低旋转后的弧度值，值固定在[0, PI * 2]之间
    float angleT = mod(currentRadius + angle, PI * 2.0);

    // 计算当前位置距离中心点距离
    float dist = distance(vec2(0.0, 0.0), vPosition);
    
    float tempOpacity = 0.0;

    // 设置雷达外层圆环的宽度 - 更宽的圆环
    float circleWidth = 8.0;
    // 如果当前点在外层圆环上， 设置一个透明度
    if (dist < u_radius && dist > u_radius - circleWidth) {
        // 做一个虚化渐变效果 - 更平滑
        float pct = smoothstep(u_radius - circleWidth, u_radius, dist);
        tempOpacity = sin(pct * PI) * 0.8;
    }

    // 设置雷达扫描圈的效果 - 优化扫描线
    float scanWidth = 0.3; // 扫描线宽度
    if (dist < (u_radius - 8.0)) {
        // 创建更明显的扫描线效果
        float scanIntensity = 1.0 - (angleT / u_width);
        // 添加扫描线边缘高亮
        float edgeGlow = 1.0 - abs(angleT - u_width * 0.5) / (u_width * 0.1);
        edgeGlow = max(0.0, edgeGlow);
        tempOpacity = scanIntensity * 0.9 + edgeGlow * 0.3;
        
        // 添加径向渐变效果
        float radialFade = 1.0 - (dist / (u_radius - 8.0));
        tempOpacity *= radialFade;
    }
    
    // 添加中心点发光效果
    float centerGlow = 1.0 - smoothstep(0.0, 15.0, dist);
    tempOpacity += centerGlow * 0.2;
    
    // 设置颜色 - 添加更丰富的颜色效果
    vec3 finalColor = u_color;
    // 根据距离添加颜色变化
    float colorMix = dist / u_radius;
    finalColor = mix(u_color, u_color * 1.3, colorMix * 0.3);
    
    gl_FragColor = vec4(finalColor, u_opacity * tempOpacity);
}`;

// 性能优化：复用几何体，减少内存占用
const radarGeometryCache = new Map<number, THREE.PlaneGeometry>();

export function drawRadar(options: RadarOption, ratio: any) {
  const { position, radius, color, opacity, speed, angle } = options;
  const size = radius * 2;
  
  // 复用相同尺寸的几何体
  let plane: THREE.PlaneGeometry;
  if (radarGeometryCache.has(size)) {
    plane = radarGeometryCache.get(size)!;
  } else {
    plane = new THREE.PlaneGeometry(size, size, 32, 32); // 减少分段数，提高性能
    radarGeometryCache.set(size, plane);
  }
  
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: ratio,
      u_radius: {
        value: radius,
      },
      u_speed: {
        value: speed,
      },
      u_opacity: {
        value: opacity,
      },
      u_width: {
        value: angle,
      },
      u_color: {
        value: new THREE.Color(color),
      },
    },
    vertexShader,
    fragmentShader,
  });
  const planeMesh = new THREE.Mesh(plane, material);
  planeMesh.position.copy(position);
  return planeMesh;
}

// 清理几何体缓存的函数
export function disposeRadarCache() {
  radarGeometryCache.forEach((geometry) => {
    geometry.dispose();
  });
  radarGeometryCache.clear();
}
