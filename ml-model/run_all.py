#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
完整的模型训练和API服务启动脚本
用法: python run_all.py [train|serve|both]
"""

import subprocess
import sys
import os

def run_train():
    """运行模型训练"""
    print("=" * 60)
    print("启动模型训练...")
    print("=" * 60)
    result = subprocess.run([sys.executable, 'src/train.py'], cwd=os.path.dirname(__file__))
    return result.returncode == 0

def run_serve():
    """运行API服务"""
    print("\n" + "=" * 60)
    print("启动API服务...")
    print("=" * 60)
    result = subprocess.run([sys.executable, 'api_server.py'], cwd=os.path.dirname(__file__))
    return result.returncode == 0

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'both'
    
    if mode == 'train':
        success = run_train()
    elif mode == 'serve':
        success = run_serve()
    elif mode == 'both':
        success = run_train()
        if success:
            success = run_serve()
    else:
        print(f"未知的模式: {mode}")
        print("用法: python run_all.py [train|serve|both]")
        sys.exit(1)
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
