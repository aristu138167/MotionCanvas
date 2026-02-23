clear();
cam(0, 200, 450, 0, 100, 0);

bailarin1 = bvh("pirouette").x(-160).color("#ff0000").trail(100).play();
bailarin2 = duplicate(bailarin1).x(0).color("#ffffff").play();
bailarin3 = duplicate(bailarin1).x(160).color("#0000ff").play();
bailarin4 = duplicate(bailarin1).x(-160).z(-160).color("#00ffff").play();
bailarin5 = duplicate(bailarin1).x(0).z(-160).color("#00ff00").play();
bailarin6 = duplicate(bailarin1).x(160).z(-160).color("#ffff00").play();

duplicate(bailarin1).reverse().play();
duplicate(bailarin2).reverse().play();
duplicate(bailarin3).reverse().play();
duplicate(bailarin4).reverse().play();
duplicate(bailarin5).reverse().play();
duplicate(bailarin6).reverse().play();