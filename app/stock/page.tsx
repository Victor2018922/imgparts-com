"use client";
import React, { useEffect, useState } from "react";

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  // 拉取产品数据
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          "https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0"
        );
        const data = await res.json();
        setProducts(data.content || []);
      } catch (err) {
        console.error("加载产品数据失败：", err);
      }
    }
    fetchData();
  }, []);

  // 加入购物车功能
  const handleAddToCart = (item) => {
    setCart((prev) => [...prev, item]);
    alert(`已加入购物车：${item.productName || item.partName || "未命名商品"}`);
  };

  // 去结算功能
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("您的购物车为空，请先添加商品。");
      return;
    }
    alert(`去结算，当前共有 ${cart.length} 个商品。`);
    // 未来可以跳转到 checkout 页面
    // router.push('/checkout');
  };

  // 查看详情功能
  const handleViewDetails = (item) => {
    alert(`查看详情：${item.productName || item.partName}`);
    // 未来可以跳转到详情页
    // router.push(`/product/${item.id}`);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">库存列表</h1>

      {/* 按钮区域 */}
      <div className="mb-4 flex gap-4">
        <button
          onClick={handleCheckout}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          去结算
        </button>
      </div>

      {/* 产品列表 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-3 shadow hover:shadow-lg transition"
          >
            <img
              src={item.imageUrl || "/no-image.png"}
              alt={item.productName || "配件图片"}
              className="w-full h-40 object-contain mb-2"
            />
            <h2 className="text-lg font-semibold truncate">
              {item.productName || item.partName || "未命名商品"}
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              品牌：{item.brandName || "未知"}  
            </p>
            <p className="text-gray-800 font-bold mb-3">
              价格：{item.price ? `￥${item.price}` : "暂无报价"}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleAddToCart(item)}
                className="flex-1 bg-green-600 text-white py-1 rounded hover:bg-green-700"
              >
                加入购物车
              </button>
              <button
                onClick={() => handleViewDetails(item)}
                className="flex-1 bg-gray-600 text-white py-1 rounded hover:bg-gray-700"
              >
                查看详情
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

