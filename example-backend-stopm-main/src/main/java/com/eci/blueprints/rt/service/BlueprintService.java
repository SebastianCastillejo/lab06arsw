package com.eci.blueprints.rt.service;

import com.eci.blueprints.rt.dto.Blueprint;
import com.eci.blueprints.rt.dto.Point;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Service;

/**
 * In-memory blueprint store. Every mutation goes through the map's atomic compute operations, so
 * concurrent draw events on the same blueprint never lose points.
 */
@Service
public class BlueprintService {

  private record Key(String author, String name) {}

  private final ConcurrentMap<Key, Blueprint> store = new ConcurrentHashMap<>();

  public BlueprintService() {
    save(new Blueprint("juan", "plano-1", List.of(new Point(10, 10), new Point(40, 50), new Point(120, 80))));
    save(new Blueprint("juan", "plano-2", List.of(new Point(200, 200), new Point(300, 250))));
    save(new Blueprint("maria", "casa", List.of(new Point(50, 300), new Point(150, 200), new Point(250, 300))));
  }

  public List<Blueprint> findAll() {
    return sorted(store.values().stream().toList());
  }

  public List<Blueprint> findByAuthor(String author) {
    return sorted(store.values().stream().filter(bp -> bp.author().equals(author)).toList());
  }

  public Blueprint get(String author, String name) {
    var bp = store.get(new Key(author, name));
    if (bp == null) throw new BlueprintNotFoundException(author, name);
    return bp;
  }

  public Blueprint create(Blueprint bp) {
    var previous = store.putIfAbsent(new Key(bp.author(), bp.name()), bp);
    if (previous != null) throw new BlueprintAlreadyExistsException(bp.author(), bp.name());
    return bp;
  }

  public Blueprint replacePoints(String author, String name, List<Point> points) {
    var updated = store.computeIfPresent(new Key(author, name), (k, bp) -> new Blueprint(author, name, points));
    if (updated == null) throw new BlueprintNotFoundException(author, name);
    return updated;
  }

  /** Appends a point, creating the blueprint on first draw so collaborators can start from an empty plan. */
  public Blueprint addPoint(String author, String name, Point point) {
    return store.compute(new Key(author, name), (k, bp) -> {
      var points = new ArrayList<Point>(bp == null ? List.of() : bp.points());
      points.add(point);
      return new Blueprint(author, name, points);
    });
  }

  public void delete(String author, String name) {
    if (store.remove(new Key(author, name)) == null) throw new BlueprintNotFoundException(author, name);
  }

  private void save(Blueprint bp) {
    store.put(new Key(bp.author(), bp.name()), bp);
  }

  private static List<Blueprint> sorted(List<Blueprint> list) {
    return list.stream()
        .sorted(Comparator.comparing(Blueprint::author).thenComparing(Blueprint::name))
        .toList();
  }
}
