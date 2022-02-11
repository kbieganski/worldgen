import { biomes } from "./biome.js";
import { Corner } from "./corner.js";
import { Cell } from "./cell.js";
import { Edge } from "./edge.js";

class World {
    constructor(opts) {
        function lloydRelaxation(voronoi, omega) {
            const points = voronoi.delaunay.points;
            for (let i = 0; i < points.length; i += 2) {
                const cell = voronoi.cellPolygon(i >> 1);
                const x0 = points[i];
                const y0 = points[i + 1];
                const [x1, y1] = d3.polygonCentroid(cell);
                points[i] = x0 + (x1 - x0) * omega;
                points[i + 1] = y0 + (y1 - y0) * omega;
            }
        }
        noise.seed(Math.random());
        const delaunay = d3.Delaunay.from(
            Array.from(
                {
                    length: opts.chunkCount,
                },
                () => [Math.random() * opts.width, Math.random() * opts.height]
            )
        );
        const voronoi = delaunay.voronoi([0, 0, opts.width, opts.height]);
        for (let i = 0; i < opts.lloydIters; i++) {
            lloydRelaxation(voronoi, opts.lloydOmega);
            voronoi.update();
        }
        this.delaunay = delaunay;
        this.width = opts.width;
        this.height = opts.height;
        this.drawGraph = false;
        this.drawMoisture = false;
        this.drawTemperature = false;
        this.drawElevation = false;
        this.noiseScale = {
            x: 100,
            y: 100,
            z: 4,
        };
        this.riverElevation = 0.25;
        this.riverProbability = 0.1;
        this.selected = null;
        this.highlighted = null;
        const points = voronoi.delaunay.points;
        let cornerMap = new Map();
        for (let cell of voronoi.cellPolygons()) {
            for (let corner of cell) {
                cornerMap.set(
                    corner.join(","),
                    new Corner(corner[0], corner[1])
                );
            }
        }
        let edgeMap = new Map();
        this.cells = [];
        for (let cell of voronoi.cellPolygons()) {
            let polygon = new Cell(
                points[cell.index * 2],
                points[cell.index * 2 + 1],
                voronoi,
                cell.index
            );
            for (let i = 0; i < cell.length - 1; i++) {
                let from = cornerMap.get(cell[i].join(","));
                let to = cornerMap.get(cell[i + 1].join(","));
                let key = [cell[i], cell[i + 1]].sort().join(",");
                let edge = edgeMap.get(key);
                if (edge) edge.addCell(polygon);
                else {
                    edge = new Edge(from, to, polygon);
                    edgeMap.set(key, edge);
                }
                polygon.addCorner(from);
                polygon.addEdge(edge);
            }
            this.cells.push(polygon);
        }
        this.corners = Array.from(cornerMap.values());
        this.edges = Array.from(edgeMap.values());
        this.makeWater();
        this.makeElevation();
        this.makeRivers();
        this.makeDistanceFromWater();
        this.makeLatitude();
        this.makeMoisture();
        this.makeTemperature();
        this.makeBiomes();
    }

    select(x, y) {
        let i = this.delaunay.find(x, y);
        this.selected = this.cells[i];
    }

    highlight(x, y) {
        let i = this.delaunay.find(x, y);
        this.highlighted = this.cells[i];
    }

    makeWater() {
        this.foreachCell((cell) => {
            cell.z = noise.perlin2(
                (cell.x / this.width) * 6,
                (cell.y / this.height) * 6
            );
            cell.water = cell.isBounding();
        });
        this.getAnyBoundingCell().floodFill(
            (cell) => (cell.water = true),
            (cell) => cell.z < 0 || cell.water
        );
    }

    makeElevation() {
        this.foreachEdge((edge) => {
            if (edge.fromCell && edge.toCell) {
                edge.coast = edge.fromCell.water != edge.toCell.water;
            }
        });
        this.foreachCorner((corner) => {
            for (let edge of corner.edges) {
                if (edge.coast) {
                    corner.coast = true;
                    corner.distanceFromCoast = 0;
                } else {
                    corner.distanceFromCoast = Infinity;
                }
            }
        });
        this.foreachCell((cell) => {
            for (let edge of cell.edges) {
                if (edge.coast) {
                    cell.coast = true;
                    return;
                }
            }
        });
        this.foreachCorner((corner) => {
            corner.traverseBreadthFirst((current, edge, other) => {
                let dist = current.distanceFromCoast;
                dist += edge.lengthCornerToCorner;
                if (dist < other.distanceFromCoast) {
                    other.distanceFromCoast = dist;
                    return true;
                }
                return false;
            });
        });

        let maxDistanceFromCoast = -Infinity;
        this.foreachCorner((corner) => {
            maxDistanceFromCoast = Math.max(
                maxDistanceFromCoast,
                corner.distanceFromCoast
            );
        });

        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
        const elevationFunc = (x) =>
            Math.pow(sigmoid(30 * x) - 0.5 + sigmoid(8 * x - 4), 3);
        this.foreachCorner((corner) => {
            corner.distanceFromCoast /= maxDistanceFromCoast;
            corner.z = elevationFunc(corner.distanceFromCoast);
            if (corner.isSea()) corner.z = -corner.z;
        });

        this.foreachCell((cell) => {
            cell.distanceFromCoast = 0;
            for (let corner of cell.corners) {
                cell.distanceFromCoast = Math.max(
                    cell.distanceFromCoast,
                    corner.distanceFromCoast
                );
            }
            cell.z = 0;
            for (let corner of cell.corners) {
                if (Math.abs(corner.z) > Math.abs(cell.z)) cell.z = corner.z;
            }
        });

        let maxElevation = 0;
        this.foreachCell((cell) => {
            maxElevation = Math.max(maxElevation, Math.abs(cell.z));
        });
        this.foreachCell((cell) => {
            cell.z /= maxElevation;
        });

        this.foreachEdge((edge) => {
            if (edge.fromCorner.z < edge.toCorner.z)
                edge.downslope = edge.fromCorner;
            else edge.downslope = edge.toCorner;
        });
    }

    makeRivers() {
        function makeRiver(corner) {
            if (corner.isSea()) return;
            let next = null;
            let nextEdge = null;
            for (let edge of corner.edges) {
                let other = edge.downslope;
                if (edge.downslope == corner) continue;
                if (!next) {
                    next = edge.downslope;
                    nextEdge = edge;
                } else if (next.z < edge.downslope.z) {
                    next = edge.downslope;
                    nextEdge = edge;
                }
            }
            if (next) {
                nextEdge.river = true;
                makeRiver(next);
            }
        }
        this.foreachCorner((corner) => {
            if (
                corner.z > this.riverElevation &&
                Math.random() < this.riverProbability
            ) {
                makeRiver(corner);
            }
        });
    }

    makeDistanceFromWater() {
        this.foreachCorner((corner) => {
            if (corner.isWater()) {
                corner.distanceFromWater = 0;
                corner.traverseBreadthFirst((current, edge, other) => {
                    if (other.isWater()) return false;
                    let dist =
                        current.distanceFromWater + edge.lengthCornerToCorner;
                    if (
                        other.distanceFromWater === undefined ||
                        dist < other.distanceFromWater
                    ) {
                        other.distanceFromWater = dist;
                        return true;
                    }
                    return false;
                });
            }
        });
        this.foreachCorner((corner) => {
            if (corner.isFreshwater()) {
                corner.distanceFromFreshwater = 0;
                corner.traverseBreadthFirst((current, edge, other) => {
                    if (other.isWater()) return false;
                    let dist =
                        current.distanceFromFreshwater +
                        edge.lengthCornerToCorner;
                    if (
                        other.distanceFromFreshwater === undefined ||
                        dist < other.distanceFromFreshwater
                    ) {
                        other.distanceFromFreshwater = dist;
                        return true;
                    }
                    return false;
                });
            }
        });

        let maxDistanceFromFreshwater = -Infinity;
        let maxDistanceFromWater = -Infinity;
        this.foreachCorner((corner) => {
            if (corner.distanceFromFreshwater !== undefined)
                maxDistanceFromFreshwater = Math.max(
                    maxDistanceFromFreshwater,
                    corner.distanceFromFreshwater
                );
            maxDistanceFromWater = Math.max(
                maxDistanceFromWater,
                corner.distanceFromWater
            );
        });
        this.foreachCorner((corner) => {
            if (corner.distanceFromFreshwater === undefined)
                corner.distanceFromFreshwater = 1;
            else corner.distanceFromFreshwater /= maxDistanceFromFreshwater;
            corner.distanceFromWater /= maxDistanceFromWater;
        });

        this.foreachCell((cell) => {
            cell.distanceFromWater = 0;
            cell.distanceFromFreshwater = 0;
            for (let corner of cell.corners) {
                cell.distanceFromFreshwater = Math.max(
                    cell.distanceFromFreshwater,
                    corner.distanceFromFreshwater
                );
                cell.distanceFromWater = Math.max(
                    cell.distanceFromWater,
                    corner.distanceFromWater
                );
            }
        });
    }

    makeLatitude() {
        this.foreachCell((cell) => {
            cell.latitude = (cell.y / this.height) * 2 - 1;
        });
    }

    makeMoisture() {
        let maxMoisture = 0;
        this.foreachCell((cell) => {
            cell.moisture = 1 - Math.pow(cell.distanceFromFreshwater, 2);
            cell.moisture *= 1 - Math.pow(1 - Math.abs(cell.latitude), 4);
            maxMoisture = Math.max(maxMoisture, cell.moisture);
        });
        this.foreachCell((cell) => {
            cell.moisture /= maxMoisture;
        });
    }

    makeTemperature() {
        let maxTemperature = 0;
        this.foreachCell((cell) => {
            if (cell.water) cell.temperature = 0;
            else {
                cell.temperature = 1 - Math.pow(Math.abs(cell.latitude), 2);
                cell.temperature *= Math.pow(1 - Math.max(cell.z, 0), 2);
                cell.temperature *= Math.max(
                    0.5,
                    Math.pow(cell.distanceFromCoast, 2)
                );
                maxTemperature = Math.max(maxTemperature, cell.temperature);
            }
        });
        this.foreachCell((cell) => {
            cell.temperature /= maxTemperature;
        });
    }

    makeBiomes() {
        this.foreachCell((cell) => {
            if (cell.water) cell.biome = biomes.water;
            else if (cell.temperature < 0.25) cell.biome = biomes.polar;
            else if (cell.temperature < 0.5) {
                if (cell.moisture > 0.5) cell.biome = biomes.taiga;
                else cell.biome = biomes.tundra;
            } else if (cell.temperature > 0.75) {
                if (cell.moisture > 0.75) cell.biome = biomes.jungle;
                else if (cell.moisture > 0.5) cell.biome = biomes.savanna;
                else if (cell.coast) cell.biome = biomes.beach;
                else cell.biome = biomes.desert;
            } else {
                if (cell.distanceFromCoast < 0.1 && cell.z < 0.05)
                    cell.biome = biomes.beach;
                else if (cell.moisture > 0.5) cell.biome = biomes.forest;
                else cell.biome = biomes.grassland;
            }
        });
    }

    foreachCorner(fn) {
        for (let corner of this.corners) fn(corner);
    }

    foreachEdge(fn) {
        for (let edge of this.edges) fn(edge);
    }

    foreachCell(fn) {
        for (let cell of this.cells) fn(cell);
    }

    getAnyBoundingCell() {
        for (let cell of this.cells) {
            if (cell.isBounding()) return cell;
        }
    }

    cell(x, y) {
        if (x < 0 || x > this.width) return null;
        if (y < 0 || y > this.height) return null;
        let d =
            noise.perlin2(
                (x / this.width) * this.noiseScale.x,
                (y / this.height) * this.noiseScale.y
            ) * this.noiseScale.z;
        x += d;
        y += d;
        let i = this.delaunay.find(x, y);
        let cell = this.cells[i];
        return cell;
    }

    elevation(x, y) {
        if (x < 0 || x > this.width) return 0;
        if (y < 0 || y > this.height) return 0;
        let d =
            noise.perlin2(
                (x / this.width) * this.noiseScale.x,
                (y / this.height) * this.noiseScale.y
            ) * this.noiseScale.z;
        x += d;
        y += d;
        let i = this.delaunay.find(x, y);
        let cell = this.cells[i];
        return cell.elevation(x, y);
    }

    color(x, y) {
        let cell = this.cell(x, y);
        if (cell) return cell.biome.color;
        return biomes.water.color;
    }

    drawToImage(image, width, height, beginx, beginy, endx, endy) {
        let dx = (endx - beginx) / width;
        let dy = (endy - beginy) / height;
        for (let j = 0; j < height; j++) {
            let y = beginy + j * dy;
            for (let i = 0; i < width; i++) {
                let x = beginx + i * dx;
                let index = (i + width * j) * 4;
                let color = this.color(x, y).rgb();
                image[index] = color[0];
                image[index + 1] = color[1];
                image[index + 2] = color[2];
                image[index + 3] = 255;
            }
        }
    }

    draw(context) {
        if (!this.image) {
            this.image = context.getImageData(0, 0, this.width, this.height);
            this.drawToImage(
                this.image.data,
                this.width,
                this.height,
                0,
                0,
                this.width,
                this.height
            );
        }
        context.putImageData(this.image, 0, 0);
        for (let edge of this.edges) {
            edge.drawRiver(context);
        }
        if (this.drawMoisture)
            this.foreachCell((cell) => cell.drawMoisture(context));
        else if (this.drawTemperature)
            this.foreachCell((cell) => cell.drawTemperature(context));
        else if (this.drawElevation)
            this.foreachCell((cell) => cell.drawElevation(context));
        if (this.drawGraph) {
            for (let edge of this.edges) {
                edge.drawCornerEdge(context);
            }
            for (let edge of this.edges) {
                edge.drawCenterEdge(context);
            }
            for (let corner of this.corners) {
                corner.draw(context);
            }
            for (let cell of this.cells) {
                cell.drawCenter(context);
            }
        }
        if (this.highlighted) this.highlighted.drawHighlighted(context);
        if (this.selected) this.selected.drawSelected(context);
    }
}

export { World };
