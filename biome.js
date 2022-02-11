class Biome {
    constructor(name, color, treeThreshold) {
        this.name = name;
        this.color = chroma(color);
        this.treeThreshold = treeThreshold;
    }

    tree(x, y) {
        let z = noise.perlin2(x, y);
        return z > this.treeThreshold;
    }
}

const biomes = {
    water: new Biome("Water", "#39d"),
    polar: new Biome("Polar", "#ddd"),
    tundra: new Biome("Tundra", "#598"),
    taiga: new Biome("Taiga", "#6b9"),
    forest: new Biome("Forest", "#4b7"),
    grassland: new Biome("Grassland", "#6d8"),
    jungle: new Biome("Jungle", "#3d6"),
    savanna: new Biome("Savanna", "#df8"),
    beach: new Biome("Beach", "#ffa"),
    desert: new Biome("Desert", "#fd8"),
};

export { Biome, biomes };
