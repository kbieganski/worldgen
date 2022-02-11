import * as THREE from "https://unpkg.com/three@0.127.0/build/three.module.js";
import {
    MapControls,
    OrbitControls,
} from "https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "https://unpkg.com/three@0.127.0/examples/jsm/loaders/FBXLoader.js";

class View {
    constructor(world) {
        this.chunkSize = 100;
        this.world = world;

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            1,
            1000
        );
        this.camera.up.set(0, 0, 1);
        this.scene.add(this.camera);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithimicDepthBuffer: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document
            .getElementById("threejs")
            .appendChild(this.renderer.domElement);

        this.controls = new MapControls(
            this.camera,
            document.getElementById("threejs")
        );
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 50;
        this.controls.minPolarAngle = (Math.PI * 1) / 8;
        this.controls.maxPolarAngle = (Math.PI * 2) / 8;

        this.scene.fog = new THREE.FogExp2(0xaaccff, 0.01);

        this.hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        this.hemiLight.color.setHSL(0.6, 1, 0.75);
        this.hemiLight.groundColor.setHSL(0.095, 1, 0.25);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.dirLight.color.setHSL(0.12, 1, 0.9);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        const d = 1000;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.camera.far = 1000;
        this.dirLight.shadow.bias = -0.01;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.renderer.shadowMap.enabled = true;

        const planeGeometry = new THREE.PlaneGeometry(3200, 3200);
        const material = new THREE.MeshPhongMaterial({
            color: 0x3399dd,
            side: THREE.DoubleSide,
            shininess: 60,
            specular: 0x222222,
        });
        const plane = new THREE.Mesh(planeGeometry, material);
        this.scene.add(plane);
        this.clock = new THREE.Clock();
        this.currentChunks = new Map();
    }

    render() {
        let dt = this.clock.getDelta();
        this.controls.update(dt);
        this.camera.position.z = Math.max(
            this.camera.position.z,
            this.world.elevation(
                this.camera.position.x,
                this.world.height - this.camera.position.y
            ) + 5
        );
        this.dirLight.position.x =
            this.dirLight.target.position.x +
            Math.cos(this.clock.getElapsedTime());
        this.dirLight.position.y = this.dirLight.target.position.y;
        this.dirLight.position.z =
            this.dirLight.target.position.z +
            Math.sin(this.clock.getElapsedTime());
        this.loadArea(
            this.controls.target.x,
            this.world.height - this.controls.target.y
        );
        this.renderer.render(this.scene, this.camera);
    }

    moveTo(posx, posy) {
        this.controls.target.x = posx;
        this.controls.target.y = this.world.height - posy;
        this.controls.target.z = this.world.elevation(
            posx,
            this.world.height - posy
        );
        this.dirLight.target.position.copy(this.controls.target);
        this.dirLight.position.x = this.dirLight.target.position.x - 10;
        this.dirLight.position.y = this.dirLight.target.position.y + 20;
        this.dirLight.position.z = this.dirLight.target.position.z + 10;
    }

    loadArea(posx, posy) {
        let i = Math.floor(posx / this.chunkSize);
        let j = Math.floor(posy / this.chunkSize);
        let oldChunks = this.currentChunks;
        this.currentChunks = new Map();
        this.loadKey(oldChunks, i - 1, j - 1, this.chunkSize);
        this.loadKey(oldChunks, i - 1, j, this.chunkSize);
        this.loadKey(oldChunks, i - 1, j + 1, this.chunkSize);
        this.loadKey(oldChunks, i, j - 1, this.chunkSize);
        this.loadKey(oldChunks, i, j, this.chunkSize);
        this.loadKey(oldChunks, i, j + 1, this.chunkSize);
        this.loadKey(oldChunks, i + 1, j - 1, this.chunkSize);
        this.loadKey(oldChunks, i + 1, j, this.chunkSize);
        this.loadKey(oldChunks, i + 1, j + 1, this.chunkSize);
        for (const [key, mesh] of oldChunks) {
            if (!this.currentChunks.get(key)) {
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.scene.remove(mesh);
            }
        }
        if (oldChunks.size != this.currentChunks.size)
            this.renderer.renderLists.dispose();
    }

    loadKey(oldChunks, i, j) {
        let key = i + "," + j;
        if (oldChunks.get(key)) {
            this.currentChunks.set(key, oldChunks.get(key));
            return;
        }
        let x = i * this.chunkSize;
        if (x < 0 || x > this.world.height) return;
        let y = j * this.chunkSize;
        if (y < 0 || y > this.world.height) return;
        let mesh = this.generateMesh(x, y);
        this.currentChunks.set(key, mesh);
    }

    generateMesh(posx, posy) {
        const meshSize = 64;
        const texSize = 256;
        const terrain = new Array((meshSize + 1) * (meshSize + 1));
        for (let i = 0; i < meshSize + 1; i++) {
            for (let j = 0; j < meshSize + 1; j++) {
                let x = (i / meshSize) * this.chunkSize + posx;
                let y = (j / meshSize) * this.chunkSize + posy;
                let z = this.world.elevation(x, y) || 0;
                terrain[i * (meshSize + 1) + j] = z;
            }
        }
        const martini = new Martini(meshSize + 1);
        const tile = martini.createTile(terrain);
        const generated = tile.getMesh(0.1);
        const vertices = new Float32Array((generated.vertices.length / 2) * 3);
        const uv = [];
        for (let i = 0; i < vertices.length / 3; i++) {
            let x = (generated.vertices[2 * i + 0] / meshSize) * this.chunkSize;
            let y = (generated.vertices[2 * i + 1] / meshSize) * this.chunkSize;
            vertices[3 * i + 0] = x + posx;
            vertices[3 * i + 1] = this.world.height - (y + posy);
            vertices[3 * i + 2] =
                terrain[
                    generated.vertices[2 * i] * (meshSize + 1) +
                        generated.vertices[2 * i + 1]
                ];
            if (vertices[3 * i + 2] < 0) vertices[3 * i + 2] *= 10;
            else if (vertices[3 * i + 2] < 0.1) vertices[3 * i + 2] = 0.1;
            uv.push(x / this.chunkSize);
            uv.push(y / this.chunkSize);
        }
        const triangles = [];
        for (let i = 0; i < generated.triangles.length; i += 3) {
            let j = i + 1;
            let k = j + 1;
            if (
                vertices[3 * generated.triangles[i] + 2] > 0 ||
                vertices[3 * generated.triangles[j] + 2] > 0 ||
                vertices[3 * generated.triangles[k] + 2] > 0
            )
                triangles.push(
                    generated.triangles[i],
                    generated.triangles[j],
                    generated.triangles[k]
                );
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(triangles);
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        const material = new THREE.MeshPhongMaterial({
            shininess: 0,
        });
        const img = new Uint8Array(texSize * texSize * 4).fill(255);
        this.world.drawToImage(
            img,
            texSize,
            texSize,
            posx,
            posy,
            posx + this.chunkSize,
            posy + this.chunkSize
        );
        material.map = new THREE.DataTexture(
            img,
            texSize,
            texSize,
            THREE.RGBAFormat,
            THREE.UnsignedByteType,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.LinearFilter,
            THREE.LinearFilter,
            this.renderer.capabilities.getMaxAnisotropy()
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        return mesh;
    }
}

export { View };
