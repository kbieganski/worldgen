class Edge {
    constructor(fromCorner, toCorner, fromCell, toCell) {
        this.fromCorner = fromCorner;
        this.toCorner = toCorner;
        this.fromCell = fromCell;
        this.toCell = toCell;
        this.coast = false;
        this.lengthCornerToCorner = Math.sqrt(
            Math.pow(fromCorner.x - toCorner.x, 2) +
                Math.pow(fromCorner.y - toCorner.y, 2)
        );
        this.downslope = null;
        this.river = false;
        fromCorner.addEdge(this);
        toCorner.addEdge(this);
    }

    drawCenterEdge(context) {
        if (!this.fromCell || !this.toCell) return;
        context.strokeStyle = "orange";
        context.beginPath();
        context.moveTo(this.fromCell.x, this.fromCell.y);
        context.lineTo(this.toCell.x, this.toCell.y);
        context.closePath();
        context.stroke();
    }

    drawRiver(context) {
        if (!this.river) return;
        context.strokeStyle = "#69e";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(this.fromCorner.x, this.fromCorner.y);
        context.lineTo(this.toCorner.x, this.toCorner.y);
        context.closePath();
        context.stroke();
        context.lineWidth = 1;
    }
    drawCornerEdge(context) {
        if (this.coast) context.strokeStyle = "yellow";
        else context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(this.fromCorner.x, this.fromCorner.y);
        context.lineTo(this.toCorner.x, this.toCorner.y);
        context.closePath();
        context.stroke();
    }
    cornerEdgePath(context) {
        if (!this.fromCorner || !this.toCorner) return;
        context.moveTo(this.fromCorner.x, this.fromCorner.y);
        context.lineTo(this.toCorner.x, this.toCorner.y);
    }

    addCell(cell) {
        if (this.fromCell && cell != this.fromCell) this.toCell = cell;
        else if (!this.fromCell) this.fromCell = cell;
    }

    traverseCorners(from) {
        let to = this.fromCorner;
        if (to == from) to = this.toCorner;
        return to;
    }
}

export { Edge };
