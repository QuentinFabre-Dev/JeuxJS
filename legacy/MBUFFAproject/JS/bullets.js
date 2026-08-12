class Bullet {
    constructor(x,y,angle,balle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.balle = balle;
    }

    // -------- Dessine les balles sur la carte  --------//
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x-10, this.y-10);
        context.beginPath();
        context.fillStyle="#FF4422"
        ctx.drawImage(this.balle, 0, 0, 20, 20);
        context.fill();
        ctx.restore();
    }

    
    move() {
        this.x -= 10 * Math.cos(this.angle);
        this.y -= 10 * Math.sin(this.angle);
    }
}
