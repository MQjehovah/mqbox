import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('E:/workspace_mqbox/tests/unit/plugin/everything/everything.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: 数组格式搜索结果 - wrap in {results: [...]}
old1 = '''        Promise.resolve([
          { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
          { name: 'file2.pdf', path: 'C:\\\\test\\\\file2.pdf', size: 2048, date_modified: '2024-01-02' }
        ])'''
new1 = '''        Promise.resolve({
          results: [
            { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
            { name: 'file2.pdf', path: 'C:\\\\test\\\\file2.pdf', size: 2048, date_modified: '2024-01-02' }
          ]
        })'''

content = content.replace(old1, new1)

# Fix 2: Extension without dot
content = content.replace("extension: '.txt'", "extension: 'txt'")
content = content.replace("extension: '.pdf'", "extension: 'pdf'")
content = content.replace("extension: '.doc'", "extension: 'doc'")
content = content.replace("extension: '.folder'", "extension: 'folder'")

# Fix 3: 对象格式搜索结果
old2 = '''        Promise.resolve([
          { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
          { name: 'subfolder', path: 'C:\\\\test\\\\subfolder', size: 0, date_modified: '2024-01-02', type: 'folder' }
        ])'''
new2 = '''        Promise.resolve({
          results: [
            { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
            { name: 'subfolder', path: 'C:\\\\test\\\\subfolder', size: 0, date_modified: '2024-01-02', type: 'folder' }
          ]
        })'''

content = content.replace(old2, new2)

# Fix 4: 空结果
old3 = "Promise.resolve([])"
new3 = "Promise.resolve({results: []})"
content = content.replace(old3, new3)

# Fix 5: 文件夹过滤
old4 = '''        Promise.resolve([
          { name: 'Folder', path: 'C:\\\\Folder', size: 0, date_modified: '2024-01-01', type: 'folder' },
        ])'''
new4 = '''        Promise.resolve({
          results: [
            { name: 'Folder', path: 'C:\\\\Folder', size: 0, date_modified: '2024-01-01', type: 'folder' },
          ]
        })'''

content = content.replace(old4, new4)

# Fix 6: 最大结果数
old5 = '''        Promise.resolve([
          { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
        ])'''
new5 = '''        Promise.resolve({
          results: [
            { name: 'file1.txt', path: 'C:\\\\test\\\\file1.txt', size: 1024, date_modified: '2024-01-01' },
          ]
        })'''

content = content.replace(old5, new5)

# Fix 7: 特殊字符
old6 = '''        Promise.resolve([
          { name: 'file [test] (1).txt', path: 'C:\\\\test\\\\file [test] (1).txt', size: 100, date_modified: '2024-01-01' },
        ])'''
new6 = '''        Promise.resolve({
          results: [
            { name: 'file [test] (1).txt', path: 'C:\\\\test\\\\file [test] (1).txt', size: 100, date_modified: '2024-01-01' },
          ]
        })'''

content = content.replace(old6, new6)

# Write back
with open('E:/workspace_mqbox/tests/unit/plugin/everything/everything.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Fixed test file.")
print(f"Total length: {len(content)} chars")
