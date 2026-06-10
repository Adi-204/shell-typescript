class TrieNode {
  public children: Map<string, TrieNode>;
  public isLeaf: boolean;
  constructor() {
    this.children = new Map();
    this.isLeaf = false;
  }
}

export class Trie {
  private root: TrieNode;
  constructor() {
    this.root = new TrieNode();
  }

  insert(word: string) {
    let curr = this.root;
    for (const char of word) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
    }
    curr.isLeaf = true;
  }

  
  nodeAt(prefix: string): TrieNode | null {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children.has(char)) return null;
      curr = curr.children.get(char)!;
    }
    return curr;
  }

  lcp(prefix: string): string {
    let curr = this.nodeAt(prefix);
    if (!curr) return prefix;

    let result = prefix;
    while (true) {
      if (curr.isLeaf) break;          
      if (curr.children.size !== 1) break; 
      const [char, nextNode] = [...curr.children][0];
      result += char;
      curr = nextNode;
    }
    return result;
  }

  countMatches(prefix: string): number {
    const node = this.nodeAt(prefix);
    if (!node) return 0;
    return this.countWords(node);
  }

  private countWords(node: TrieNode): number {
    let count = node.isLeaf ? 1 : 0;
    for (const child of node.children.values()) {
      count += this.countWords(child);
    }
    return count;
  }

  getAllMatches(prefix: string): string[] {
    const node = this.nodeAt(prefix);
    if (!node) return [];
    const results: string[] = [];
    this.collectWords(node, prefix, results);
    return results.sort();
  }

  private collectWords(node: TrieNode, current: string, results: string[]) {
    if (node.isLeaf) results.push(current);
    for (const [char, child] of node.children) {
      this.collectWords(child, current + char, results);
    }
  }
}