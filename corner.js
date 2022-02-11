class Corner {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.edges = [];
        this.cells = [];
        this.coast = false;
    }

    draw(context) {
        if (this.coast) context.fillStyle = "yellow";
        else context.fillStyle = "purple";
        context.beginPath();
        context.ellipse(this.x, this.y, 2, 2, 0, 0, 2 * Math.PI);
        context.closePath();
        context.fill();
    }

    isSea() {
        if (this.coast) return true;
        for (let cell of this.cells) {
            if (cell.water) return true;
        }
        return false;
    }

    isWater() {
        if (this.coast) return true;
        for (let edge of this.edges) {
            if (edge.river) return true;
        }
        for (let cell of this.cells) {
            if (cell.water) return true;
        }
        return false;
    }

    isFreshwater() {
        for (let edge of this.edges) {
            if (edge.river) return true;
        }
        return false;
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    addCell(cell) {
        this.cells.push(cell);
    }

    traverseBreadthFirst(fn) {
        let queue = [this];
        let set = new Set();
        set.add(this);
        while (queue.length) {
            let current = queue.shift();
            for (let edge of current.edges) {
                let other = edge.traverseCorners(current);
                if (!set.has(other)) {
                    set.add(other);
                    if (fn(current, edge, other)) queue.push(other);
                }
            }
        }
    }
}

export { Corner };
