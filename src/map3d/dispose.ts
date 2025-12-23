import * as THREE from "three";

type AnyMaterial = THREE.Material & Record<string, any>;

function disposeMaterial(mat: AnyMaterial) {
  // 尝试释放材质上挂载的纹理（不同材质字段不完全一致，这里做通用兜底）
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && typeof value === "object" && "isTexture" in value) {
      try {
        (value as THREE.Texture).dispose();
      } catch {
        // ignore
      }
    }
  }

  try {
    mat.dispose();
  } catch {
    // ignore
  }
}

/**
 * 递归释放 Object3D 及其子节点的几何体/材质/纹理，避免 WebGL 资源泄漏
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined) {
  if (!root) return;

  root.traverse((obj: any) => {
    if (obj.geometry && typeof obj.geometry.dispose === "function") {
      try {
        obj.geometry.dispose();
      } catch {
        // ignore
      }
    }

    const material = obj.material as AnyMaterial | AnyMaterial[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((m) => m && disposeMaterial(m));
    } else if (material) {
      disposeMaterial(material);
    }
  });
}


