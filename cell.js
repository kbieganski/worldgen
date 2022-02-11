class Cell {
    constructor(x, y, voronoi, index) {
        this.x = x;
        this.y = y;
        this.z = 0;
        this.voronoi = voronoi;
        this.index = index;
        this.corners = [];
        this.edges = [];
        this.water = false;
        this.ocean = false;
        this.moisture = 0;
    }

    drawCenter(context) {
        context.fillStyle = "red";
        context.beginPath();
        context.ellipse(this.x, this.y, 2, 2, 0, 0, 2 * Math.PI);
        context.closePath();
        context.fill();
    }

    drawCorners(context) {
        for (let corner of this.corners) corner.draw(context);
    }

    drawEdges(context) {
        for (let edge of this.edges) edge.drawCornerEdge(context);
    }

    addCorner(corner) {
        this.corners.push(corner);
        corner.cells.push(this);
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    isBounding() {
        for (let edge of this.edges) {
            if (!edge.fromCell || !edge.toCell) return true;
        }
        return false;
    }

    drawPath(context) {
        context.beginPath();
        context.moveTo(this.corners[0].x, this.corners[0].y);
        for (let corner of this.corners.slice(1)) {
            context.lineTo(corner.x, corner.y);
        }
        context.closePath();
    }

    drawMoisture(context) {
        let color = this.biome.color;
        color = chroma.mix(
            color,
            chroma("#69b").brighten(1 - this.moisture),
            0.95
        );
        context.fillStyle = color.hex();
        this.drawPath(context);
        context.fill();
    }

    drawTemperature(context) {
        let color = this.biome.color;
        color = chroma.mix(
            color,
            chroma("#f85").darken(this.temperature),
            0.95
        );
        context.fillStyle = color.hex();
        this.drawPath(context);
        context.fill();
    }

    drawElevation(context) {
        let color = this.biome.color;
        color = chroma.mix(color, chroma("#888").brighten(this.z * 2), 0.95);
        context.fillStyle = color.hex();
        this.drawPath(context);
        context.fill();
    }

    drawSelected(context) {
        context.strokeStyle = "#f00";
        context.fillStyle = "#0000";
        context.lineWidth = 3;
        this.drawPath(context);
        context.stroke();
    }

    drawHighlighted(context) {
        context.strokeStyle = "#000";
        context.fillStyle = "#0000";
        context.lineWidth = 2;
        this.drawPath(context);
        context.stroke();
    }

    elevation(x, y) {
        function interpolateInTriangle(triangle, point, fields) {
            let [A, B, C] = triangle;
            let weightA =
                ((B.y - C.y) * (point.x - C.x) +
                    (C.x - B.x) * (point.y - C.y)) /
                ((B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y));
            let weightB =
                ((C.y - A.y) * (point.x - C.x) +
                    (A.x - C.x) * (point.y - C.y)) /
                ((B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y));
            let weightC = 1 - weightA - weightB;
            if (weightA >= -1e-6 && weightB >= -1e-6 && weightC >= -1e-6) {
                let values = {};
                for (const field of fields)
                    values[field] =
                        weightA * A[field] +
                        weightB * B[field] +
                        weightC * C[field];
                return values;
            }
            return undefined;
        }

        function interpolateInTriangles(triangles, point, fields) {
            for (let triangle of triangles) {
                let values = interpolateInTriangle(triangle, point, fields);
                if (values !== undefined) return values;
            }
            return undefined;
        }

        function triangulate(center, vertices) {
            let triangles = [];
            vertices = vertices.sort((first, second) => {
                let a = Math.atan2(first.x - center.x, first.y - center.y);
                let b = Math.atan2(second.x - center.x, second.y - center.y);
                return a - b;
            });
            let skip = new Set();
            let i = 0;
            while (triangles.length < vertices.length - 2) {
                let j = i;
                do {
                    j = (j + 1) % vertices.length;
                } while (skip.has(j));
                let k = j;
                do {
                    k = (k + 1) % vertices.length;
                } while (skip.has(k));
                let triangle = [k, j, i];
                skip.add(j);
                triangles.push(triangle);
                i = k;
            }
            return {
                vertices: vertices,
                triangles: triangles,
            };
        }

        let corners = [];
        for (let corner of this.corners)
            corners.push({
                x: corner.x,
                y: corner.y,
                z: corner.z,
                distFromWater: this.water ? corner.distanceFromWater : 0,
            });
        let { vertices, triangles } = triangulate(this, corners);
        triangles = triangles.map((indices) => [
            vertices[indices[0]],
            vertices[indices[1]],
            vertices[indices[2]],
        ]);
        const values = interpolateInTriangles(
            triangles,
            {
                x: x,
                y: y,
            },
            ["z", "distFromWater"]
        );
        if (values === undefined) return this.z;
        const { z, distFromWater } = values;
        const noiseDelta =
            (noise.perlin2(x / 4, y / 4) + 1) * 2 +
            (noise.perlin2(x / 2, y / 2) + 1) * 1;
        return 20 * z + noiseDelta * distFromWater;
    }

    floodFill(fn, pred, visited) {
        visited = visited || new Set();
        if (visited.has(this)) return;
        visited.add(this);
        if (!pred(this)) return;
        fn(this);
        for (let neighbor of this.neighbors()) {
            if (neighbor) neighbor.floodFill(fn, pred, visited);
        }
    }

    *neighbors() {
        for (let edge of this.edges) {
            let cell = null;
            if (this == edge.fromCell) cell = edge.toCell;
            else cell = edge.fromCell;
            if (cell) yield cell;
        }
    }
}

export { Cell };
