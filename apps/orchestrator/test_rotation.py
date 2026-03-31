import random

def parse_coord(coord):
    # coord like "C4". X is A-Z (skip I usually, but let's check standard).
    # Assuming WGo.js standard: A, B, C, D, E, F, G, H, J
    col_char = coord[0].upper()
    row_str = coord[1:]
    
    # WGo standard mapping
    cols = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
    x = cols.index(col_char)
    y = int(row_str) - 1 # 0-indexed
    return x, y

def to_coord(x, y):
    cols = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
    if x < 0 or x >= len(cols) or y < 0:
        return None
    return f"{cols[x]}{y + 1}"

def rotate_point(x, y, size, degrees):
    # center is (size-1)/2.0
    # translate to origin
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0
    
    rx = x - cx
    ry = y - cy
    
    if degrees == 90:
        # x' = -y, y' = x
        nx, ny = -ry, rx
    elif degrees == 180:
        nx, ny = -rx, -ry
    elif degrees == 270:
        # x' = y, y' = -x
        nx, ny = ry, -rx
    else:
        nx, ny = rx, ry
        
    return int(nx + cx), int(ny + cy)

def extract_local_cluster(black_stones, white_stones, center_coord, radius=3):
    cx, cy = parse_coord(center_coord)
    
    cluster_b = []
    cluster_w = []
    
    for b in black_stones:
        bx, by = parse_coord(b)
        if abs(bx - cx) <= radius and abs(by - cy) <= radius:
            cluster_b.append(b)
            
    for w in white_stones:
        wx, wy = parse_coord(w)
        if abs(wx - cx) <= radius and abs(wy - cy) <= radius:
            cluster_w.append(w)
            
    return cluster_b, cluster_w

# Test
print(parse_coord("C4"))
print(to_coord(*parse_coord("C4")))
print(to_coord(*rotate_point(2, 3, 9, 90)))
